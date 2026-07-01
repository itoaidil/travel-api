const express = require('express');
const router = express.Router();
const https = require('https');

// ─────────────────────────────────────────────
// GEOCODING HELPER (Google Maps Geocoding API)
// ─────────────────────────────────────────────

/**
 * Geocode a single address string → { lat, lng } or null.
 * Uses process.env.GOOGLE_DIRECTIONS_KEY (also valid for Geocoding API).
 */
function geocodeAddress(address) {
  return new Promise((resolve) => {
    const key = process.env.GOOGLE_DIRECTIONS_KEY;
    if (!key) return resolve(null);

    const encoded = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${key}`;

    https.get(url, (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'OK' && json.results && json.results.length > 0) {
            const loc = json.results[0].geometry.location;
            resolve({ lat: loc.lat, lng: loc.lng });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Geocode all packages for a driver that still have lat=0 / lng=0.
 * Runs concurrently (max 5 at a time) and updates DB.
 * Fire-and-forget friendly — errors per row are swallowed.
 *
 * @param {object} db    - mysql2 pool/connection
 * @param {number} driverId
 * @returns {Promise<number>} count of successfully geocoded rows
 */
async function geocodeDriverPackages(db, driverId) {
  const BATCH_SIZE = 5;

  const [rows] = await db.query(
    `SELECT id, recipient_address FROM batch_deliveries
     WHERE driver_id = ? AND (lat = 0 OR lng = 0) AND status != 'delivered'
     LIMIT 30`,
    [driverId]
  );

  if (rows.length === 0) return 0;

  let geocoded = 0;

  // Process in batches of BATCH_SIZE to avoid rate-limiting
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (row) => {
        const coords = await geocodeAddress(row.recipient_address);
        if (coords) {
          await db.query(
            `UPDATE batch_deliveries SET lat = ?, lng = ? WHERE id = ?`,
            [coords.lat, coords.lng, row.id]
          );
          geocoded++;
        }
      })
    );
  }

  return geocoded;
}

/**
 * Haversine: returns distance in km between two lat/lng points.
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the single nearest undelivered package to (lat, lng)
 * for a specific driver. Only considers rows with valid coords.
 */
async function findNextNearest(db, driverId, lat, lng) {
  const [rows] = await db.query(
    `SELECT id, row_no, npp, batch_code, penerima, recipient_address,
            lat, lng, kawasan, nama_pic_penerima, nomor_hp_pic, status,
            ROUND(
              6371 * ACOS(
                COS(RADIANS(?)) * COS(RADIANS(lat))
                * COS(RADIANS(lng) - RADIANS(?))
                + SIN(RADIANS(?)) * SIN(RADIANS(lat))
              ), 3
            ) AS distance_km
     FROM batch_deliveries
     WHERE driver_id = ?
       AND lat != 0 AND lng != 0
       AND status IN ('assigned', 'in_progress')
     ORDER BY distance_km ASC
     LIMIT 1`,
    [lat, lng, lat, driverId]
  );
  return rows[0] || null;
}

async function ensureBatchDeliveryPicColumns(db) {
  const [recipientAddressColumn] = await db.query(
    'SHOW COLUMNS FROM batch_deliveries LIKE ?',
    ['recipient_address']
  );
  const [kabupatenColumn] = await db.query(
    'SHOW COLUMNS FROM batch_deliveries LIKE ?',
    ['nama_kabupaten']
  );
  const namePicPosition = kabupatenColumn.length > 0 ? 'AFTER nama_kabupaten' : 'AFTER kawasan';

  const requiredColumns = [
    {
      name: 'recipient_district_code',
      definition: "VARCHAR(20) NULL AFTER recipient_address",
    },
    {
      name: 'nama_pic_penerima',
      definition: `VARCHAR(150) NULL ${namePicPosition}`,
    },
    {
      name: 'nomor_hp_pic',
      definition: 'VARCHAR(30) NULL AFTER nama_pic_penerima',
    },
  ];

  for (const column of requiredColumns) {
    const [existing] = await db.query(
      'SHOW COLUMNS FROM batch_deliveries LIKE ?',
      [column.name]
    );
    if (existing.length === 0) {
      await db.query(
        `ALTER TABLE batch_deliveries ADD COLUMN ${column.name} ${column.definition}`
      );
    }
  }
}

/**
 * POST /api/batch-delivery/update-latlng
 * Update lat/lng untuk daftar NPP sekaligus.
 * Body: { packages: [{ npp, lat, lng }] }
 */
router.post('/update-latlng', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    const { packages } = req.body;
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({ success: false, message: 'packages array required' });
    }
    let updated = 0;
    for (const pkg of packages) {
      if (!pkg.npp) continue;
      const [r] = await db.query(
        'UPDATE batch_deliveries SET lat = ?, lng = ? WHERE npp = ?',
        [parseFloat(pkg.lat) || 0, parseFloat(pkg.lng) || 0, String(pkg.npp)]
      );
      if (r.affectedRows > 0) updated++;
    }
    return res.json({ success: true, data: { updated } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/batch-delivery/update-bulk
 * Bulk update kolom: lat, lng, status, nama_kecamatan, nama_kabupaten,
 * nama_pic_penerima, nomor_hp_pic, nama_kelurahan.
 * lat/lng diambil dari expedition_master_districts berdasarkan kode_kecamatan.
 * Body: { packages: [{ npp, kode_kecamatan, nama_kecamatan, nama_kabupaten,
 *                      nama_kelurahan, nama_pic_penerima, nomor_hp_pic }] }
 */
router.post('/update-bulk', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const { packages } = req.body;
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({ success: false, message: 'packages array is required' });
    }

    // Cache lat/lng per kode_kecamatan
    const districtCache = {};
    const getLatLng = async (kode) => {
      if (!kode) return { lat: 0, lng: 0 };
      if (districtCache[kode]) return districtCache[kode];
      try {
        const [rows] = await db.query(
          'SELECT latitude, longitude FROM expedition_master_districts WHERE code = ? LIMIT 1',
          [String(kode)]
        );
        const result = rows.length ? { lat: rows[0].latitude || 0, lng: rows[0].longitude || 0 } : { lat: 0, lng: 0 };
        districtCache[kode] = result;
        return result;
      } catch { return { lat: 0, lng: 0 }; }
    };

    let updated = 0;
    let notFound = 0;

    for (const pkg of packages) {
      if (!pkg.npp) continue;
      const { lat, lng } = await getLatLng(pkg.kode_kecamatan);

      const [result] = await db.query(
        `UPDATE batch_deliveries SET
          lat              = ?,
          lng              = ?,
          status           = 'pending',
          nama_kecamatan   = ?,
          nama_kabupaten   = ?,
          nama_pic_penerima = ?,
          nomor_hp_pic     = ?,
          nama_kelurahan   = ?
        WHERE npp = ?`,
        [
          lat,
          lng,
          pkg.nama_kecamatan || null,
          pkg.nama_kabupaten || null,
          pkg.nama_pic_penerima || null,
          pkg.nomor_hp_pic || null,
          pkg.nama_kelurahan || null,
          String(pkg.npp),
        ]
      );

      if (result.affectedRows > 0) updated++;
      else notFound++;
    }

    return res.json({ success: true, data: { updated, not_found: notFound } });
  } catch (error) {
    console.error('[update-bulk]', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/batch-delivery/import
 * Bulk insert geocoded addresses into batch_deliveries table.
 * Body: { packages: [{ no, npp, address, lat, lng }] }
 * Skips rows with duplicate NPP (INSERT IGNORE).
 */
router.post('/import', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    await ensureBatchDeliveryPicColumns(db);
    const { packages } = req.body;
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({ success: false, message: 'packages array is required' });
    }

    let successCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const pkg of packages) {
      if (!pkg.npp) {
        errors.push({ pkg, error: 'npp is required' });
        continue;
      }
      try {
        const lat = parseFloat(pkg.lat) || 0;
        const lng = parseFloat(pkg.lng) || 0;
        const [result] = await db.query(
          `INSERT IGNORE INTO batch_deliveries (
             row_no, npp, recipient_address, recipient_district_code, lat, lng, penerima,
             nama_pic_penerima, nomor_hp_pic
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pkg.no || null,
            pkg.npp,
            pkg.address || '',
            pkg.recipient_district_code || null,
            lat,
            lng,
            pkg.penerima || null,
            pkg.nama_pic_penerima || pkg.nama_pic || null,
            pkg.nomor_hp_pic || pkg.no_hp_pic || pkg.nomor_pic || null,
          ]
        );
        if (result.affectedRows > 0 && result.insertId) {
          // Set batch_code now that we have the id
          await db.query(
            `UPDATE batch_deliveries SET batch_code = CONCAT('BATCH-', LPAD(id, 4, '0')) WHERE id = ?`,
            [result.insertId]
          );
        }
        if (result.affectedRows === 0) {
          skippedCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        errors.push({ npp: pkg.npp, error: err.message });
      }
    }

    res.json({
      success: true,
      data: {
        total_received: packages.length,
        inserted: successCount,
        skipped_duplicate: skippedCount,
        errors: errors.slice(0, 20),
      },
    });
  } catch (error) {
    console.error('Batch import error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/batch-delivery/assign
 * Admin assigns pending packages to a driver.
 * Body: { driver_id, limit } — assign up to `limit` pending packages to driver.
 */
router.post('/assign', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const { driver_id, limit = 100 } = req.body;
    if (!driver_id) return res.status(400).json({ success: false, message: 'driver_id is required' });

    const [result] = await db.query(
      `UPDATE batch_deliveries
       SET driver_id = ?, status = 'assigned', assigned_at = NOW()
       WHERE status = 'pending'
       LIMIT ?`,
      [driver_id, parseInt(limit)]
    );

    res.json({ success: true, data: { assigned: result.affectedRows, driver_id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/batch-delivery/drivers
 * List available drivers for dispatch/reassign UI.
 */
router.get('/drivers', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const [rows] = await db.query(
      `SELECT id, full_name, phone, status
       FROM independent_drivers
       ORDER BY
         CASE WHEN status = 'active' THEN 0 ELSE 1 END,
         full_name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/batch-delivery/assigned-summary
 * Summary assignment grouped by driver and kawasan.
 */
router.get('/assigned-summary', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const [rows] = await db.query(
      `SELECT
         bd.driver_id,
         COALESCE(d.full_name, CONCAT('Driver #', bd.driver_id)) AS driver_name,
         COALESCE(NULLIF(TRIM(bd.kawasan), ''), '(tanpa kawasan)') AS kawasan,
         COUNT(*) AS total_packages
       FROM batch_deliveries bd
       LEFT JOIN independent_drivers d ON d.id = bd.driver_id
       WHERE bd.status = 'assigned' AND bd.driver_id IS NOT NULL
       GROUP BY bd.driver_id, COALESCE(NULLIF(TRIM(bd.kawasan), ''), '(tanpa kawasan)')
       ORDER BY driver_name ASC, kawasan ASC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/batch-delivery/assigned-wilayah-summary
 * Summary assignment per driver grouped by kabupaten + kecamatan.
 * Query: driver_id (required)
 */
router.get('/assigned-wilayah-summary', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const driverId = parseInt(req.query.driver_id, 10);
    if (!driverId) {
      return res.status(400).json({ success: false, message: 'driver_id wajib diisi' });
    }

    const [rows] = await db.query(
      `SELECT
         COALESCE(NULLIF(TRIM(nama_kabupaten), ''), '(tanpa kabupaten)') AS nama_kabupaten,
         COALESCE(NULLIF(TRIM(nama_kecamatan), ''), '(tanpa kecamatan)') AS nama_kecamatan,
         COUNT(*) AS total_packages
       FROM batch_deliveries
       WHERE status = 'assigned' AND driver_id = ?
       GROUP BY
         COALESCE(NULLIF(TRIM(nama_kabupaten), ''), '(tanpa kabupaten)'),
         COALESCE(NULLIF(TRIM(nama_kecamatan), ''), '(tanpa kecamatan)')
       ORDER BY nama_kabupaten ASC, nama_kecamatan ASC`,
      [driverId]
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/batch-delivery/delivery-summary
 * Rekap paket yang sudah terkirim (status delivered) per driver.
 */
router.get('/delivery-summary', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const { date } = req.query; // format: YYYY-MM-DD
    const conditions = ["bd.status = 'delivered'", 'bd.driver_id IS NOT NULL'];
    const params = [];
    if (date) {
      conditions.push('DATE(bd.delivered_at) = ?');
      params.push(date);
    }
    const where = conditions.join(' AND ');

    const [rows] = await db.query(
      `SELECT
         bd.driver_id,
         COALESCE(d.full_name, CONCAT('Driver #', bd.driver_id)) AS driver_name,
         COUNT(*) AS total_delivered,
         MAX(bd.delivered_at) AS last_delivered_at
       FROM batch_deliveries bd
       LEFT JOIN independent_drivers d ON d.id = bd.driver_id
       WHERE ${where}
       GROUP BY bd.driver_id
       ORDER BY total_delivered DESC, driver_name ASC`,
      params
    );

    return res.json({ success: true, data: rows, date: date || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/batch-delivery/assigned-list
 * List assigned packages for dispatch operations.
 * Query: driver_id (optional), kawasan (optional), q (optional), page (optional), limit (optional)
 */
router.get('/assigned-list', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const { driver_id, kawasan, q, page = 1, limit = 50 } = req.query;
    const where = ["bd.status = 'assigned'"];
    const params = [];

    if (driver_id) {
      where.push('bd.driver_id = ?');
      params.push(parseInt(driver_id, 10));
    }
    if (kawasan) {
      if (kawasan === '(tanpa kawasan)') {
        where.push("(bd.kawasan IS NULL OR TRIM(bd.kawasan) = '')");
      } else {
        where.push('bd.kawasan = ?');
        params.push(kawasan);
      }
    }
    if (q && String(q).trim()) {
      const keyword = `%${String(q).trim()}%`;
      where.push(`(
        bd.npp LIKE ?
        OR COALESCE(bd.penerima, '') LIKE ?
        OR COALESCE(bd.recipient_address, '') LIKE ?
      )`);
      params.push(keyword, keyword, keyword);
    }

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (safePage - 1) * safeLimit;
    const whereClause = `WHERE ${where.join(' AND ')}`;

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM batch_deliveries bd
       ${whereClause}`,
      params
    );
    const total = Number(countRow?.total || 0);

    const [rows] = await db.query(
      `SELECT
         bd.id,
         bd.npp,
        bd.penerima,
         bd.batch_code,
         bd.recipient_address,
         bd.kawasan,
         bd.driver_id,
         COALESCE(d.full_name, CONCAT('Driver #', bd.driver_id)) AS driver_name,
         bd.assigned_at,
         bd.status
       FROM batch_deliveries bd
       LEFT JOIN independent_drivers d ON d.id = bd.driver_id
       ${whereClause}
       ORDER BY bd.assigned_at DESC, bd.id DESC
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({
      success: true,
      data: rows,
      page: safePage,
      limit: safeLimit,
      total,
      total_pages: totalPages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/batch-delivery/reassign
 * Reassign packages to another driver.
 * Mode A (per NPP): { target_driver_id, npp_list: ['NPP1', 'NPP2'], source_driver_id? }
 * Mode B (per penerima): { target_driver_id, source_driver_id, recipient_names: ['Nama 1'] }
 * Mode C (per package id): { target_driver_id, package_ids: [1,2,3] }
 * Mode D (per kawasan): { target_driver_id, source_driver_id, kawasan }
 * Mode E (per kabupaten): { target_driver_id, source_driver_id, wilayah_type: 'kabupaten', kabupaten }
 * Mode F (per kecamatan): { target_driver_id, source_driver_id, wilayah_type: 'kecamatan', kecamatan_list: ['Cikupa'], kabupaten? }
 */
router.post('/reassign', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const {
      target_driver_id,
      npp_list,
      recipient_names,
      package_ids,
      source_driver_id,
      kawasan,
      wilayah_type,
      kabupaten,
      kecamatan_list,
    } = req.body || {};

    const toDriver = parseInt(target_driver_id, 10);
    if (!toDriver) {
      return res.status(400).json({ success: false, message: 'target_driver_id wajib diisi' });
    }

    const [driverRows] = await db.query('SELECT id FROM independent_drivers WHERE id = ? LIMIT 1', [toDriver]);
    if (!driverRows.length) {
      return res.status(404).json({ success: false, message: 'Driver tujuan tidak ditemukan' });
    }

    let result;
    let mode;

    if (Array.isArray(npp_list) && npp_list.length > 0) {
      const npps = [...new Set(
        npp_list
          .map((x) => String(x || '').trim())
          .filter(Boolean)
      )];

      if (!npps.length) {
        return res.status(400).json({ success: false, message: 'npp_list tidak valid' });
      }

      const fromDriver = parseInt(source_driver_id, 10);
      const placeholders = npps.map(() => '?').join(',');
      let query =
        `UPDATE batch_deliveries
         SET driver_id = ?, assigned_at = NOW()
         WHERE status = 'assigned' AND npp IN (${placeholders})`;
      const bind = [toDriver, ...npps];

      if (fromDriver) {
        query += ' AND driver_id = ?';
        bind.push(fromDriver);
      }

      [result] = await db.query(query, bind);
      mode = 'npp';
    } else if (Array.isArray(recipient_names) && recipient_names.length > 0) {
      const fromDriver = parseInt(source_driver_id, 10);
      if (!fromDriver) {
        return res.status(400).json({
          success: false,
          message: 'Untuk mode penerima, source_driver_id wajib diisi',
        });
      }

      const names = [...new Set(
        recipient_names
          .map((x) => String(x || '').trim())
          .filter(Boolean)
      )];

      if (!names.length) {
        return res.status(400).json({ success: false, message: 'recipient_names tidak valid' });
      }

      const placeholders = names.map(() => '?').join(',');
      [result] = await db.query(
        `UPDATE batch_deliveries
         SET driver_id = ?, assigned_at = NOW()
         WHERE status = 'assigned' AND driver_id = ?
           AND COALESCE(penerima, '') IN (${placeholders})`,
        [toDriver, fromDriver, ...names]
      );
      mode = 'recipient';
    } else if (Array.isArray(package_ids) && package_ids.length > 0) {
      const ids = package_ids
        .map((x) => parseInt(x, 10))
        .filter((x) => Number.isInteger(x) && x > 0);

      if (!ids.length) {
        return res.status(400).json({ success: false, message: 'package_ids tidak valid' });
      }

      const placeholders = ids.map(() => '?').join(',');
      [result] = await db.query(
        `UPDATE batch_deliveries
         SET driver_id = ?, assigned_at = NOW()
         WHERE status = 'assigned' AND id IN (${placeholders})`,
        [toDriver, ...ids]
      );
      mode = 'package';
    } else {
      const fromDriver = parseInt(source_driver_id, 10);
      if (!fromDriver) {
        return res.status(400).json({
          success: false,
          message: 'source_driver_id wajib diisi untuk mode wilayah',
        });
      }

      if (wilayah_type === 'kabupaten') {
        const kab = String(kabupaten || '').trim();
        if (!kab) {
          return res.status(400).json({ success: false, message: 'kabupaten wajib diisi' });
        }

        if (kab === '(tanpa kabupaten)') {
          [result] = await db.query(
            `UPDATE batch_deliveries
             SET driver_id = ?, assigned_at = NOW()
             WHERE status = 'assigned' AND driver_id = ?
               AND (nama_kabupaten IS NULL OR TRIM(nama_kabupaten) = '')`,
            [toDriver, fromDriver]
          );
        } else {
          [result] = await db.query(
            `UPDATE batch_deliveries
             SET driver_id = ?, assigned_at = NOW()
             WHERE status = 'assigned' AND driver_id = ?
               AND COALESCE(NULLIF(TRIM(nama_kabupaten), ''), '(tanpa kabupaten)') = ?`,
            [toDriver, fromDriver, kab]
          );
        }
        mode = 'kabupaten';
      } else if (wilayah_type === 'kecamatan') {
        const kecamatanList = Array.isArray(kecamatan_list)
          ? [...new Set(kecamatan_list.map((x) => String(x || '').trim()).filter(Boolean))]
          : [];

        if (!kecamatanList.length) {
          return res.status(400).json({ success: false, message: 'kecamatan_list wajib diisi minimal 1 kecamatan' });
        }

        const where = [
          "status = 'assigned'",
          'driver_id = ?',
        ];
        const bind = [toDriver, fromDriver];

        const placeholders = kecamatanList.map(() => '?').join(',');
        where.push(`COALESCE(NULLIF(TRIM(nama_kecamatan), ''), '(tanpa kecamatan)') IN (${placeholders})`);
        bind.push(...kecamatanList);

        const kab = String(kabupaten || '').trim();
        if (kab) {
          if (kab === '(tanpa kabupaten)') {
            where.push('(nama_kabupaten IS NULL OR TRIM(nama_kabupaten) = \'\')');
          } else {
            where.push("COALESCE(NULLIF(TRIM(nama_kabupaten), ''), '(tanpa kabupaten)') = ?");
            bind.push(kab);
          }
        }

        [result] = await db.query(
          `UPDATE batch_deliveries
           SET driver_id = ?, assigned_at = NOW()
           WHERE ${where.join(' AND ')}`,
          bind
        );
        mode = 'kecamatan';
      } else {
        if (!kawasan) {
          return res.status(400).json({
            success: false,
            message: 'Untuk mode kawasan, source_driver_id dan kawasan wajib diisi',
          });
        }

        if (kawasan === '(tanpa kawasan)') {
          [result] = await db.query(
            `UPDATE batch_deliveries
             SET driver_id = ?, assigned_at = NOW()
             WHERE status = 'assigned' AND driver_id = ?
               AND (kawasan IS NULL OR TRIM(kawasan) = '')`,
            [toDriver, fromDriver]
          );
        } else {
          [result] = await db.query(
            `UPDATE batch_deliveries
             SET driver_id = ?, assigned_at = NOW()
             WHERE status = 'assigned' AND driver_id = ? AND kawasan = ?`,
            [toDriver, fromDriver, kawasan]
          );
        }
        mode = 'kawasan';
      }
    }

    res.json({
      success: true,
      message: 'Reassign berhasil diproses',
      data: {
        mode,
        moved: result.affectedRows || 0,
        target_driver_id: toDriver,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/batch-delivery/driver/:driverId
 * List packages assigned to a specific driver.
 * Query: status (optional), page, limit
 */
router.get('/driver/:driverId', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    await ensureBatchDeliveryPicColumns(db);
    const { driverId } = req.params;
    const { status, page = 1, limit = 100 } = req.query;
    const where = ['driver_id = ?'];
    const params = [driverId];

    if (status) { where.push('status = ?'); params.push(status); }

    const whereClause = 'WHERE ' + where.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
            `SELECT id, row_no, npp, recipient_address, lat, lng, wave, status,
              penerima, batch_code, kawasan, nama_pic_penerima, nomor_hp_pic,
              delivery_photo_url, driver_notes, assigned_at, delivered_at, updated_at
       FROM batch_deliveries ${whereClause}
       ORDER BY CAST(row_no AS UNSIGNED) ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM batch_deliveries ${whereClause}`,
      params
    );

    const [[summary]] = await db.query(
      `SELECT
         SUM(status = 'assigned')         AS todo,
         SUM(status = 'in_progress')      AS in_progress,
         SUM(status = 'delivered')        AS delivered,
         SUM(status = 'not_found')        AS not_found,
         SUM(status = 'address_mismatch') AS address_mismatch,
         SUM(status = 'refused')          AS refused
       FROM batch_deliveries WHERE driver_id = ?`,
      [driverId]
    );

    res.json({ success: true, data: rows, total, summary, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/batch-delivery/:id
 * Get single package detail.
 */
router.get('/:id', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    await ensureBatchDeliveryPicColumns(db);
    const [rows] = await db.query(
      `SELECT * FROM batch_deliveries WHERE id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/batch-delivery/:id/status
 * Driver updates delivery status.
 *
 * Body:
 *   status       - in_progress | delivered | not_found | address_mismatch | refused | returned
 *   driver_notes - optional text notes
 *   driver_lat   - current GPS latitude of driver (required when status = 'delivered')
 *   driver_lng   - current GPS longitude of driver (required when status = 'delivered')
 *
 * When status = 'delivered':
 *   1. Marks the package as delivered
 *   2. Triggers background geocoding for all remaining ungeocoded packages on this driver
 *   3. Returns the next nearest package (next_stop) in the response
 */
router.patch('/:id/status', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const { status, driver_notes, driver_lat, driver_lng } = req.body;
    const allowed = ['in_progress', 'delivered', 'not_found', 'address_mismatch', 'refused', 'returned'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    // Fetch current package to get driver_id
    const [[pkg]] = await db.query(
      `SELECT id, driver_id, npp, penerima FROM batch_deliveries WHERE id = ?`,
      [req.params.id]
    );
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    // Update status
    const deliveredAt = status === 'delivered' ? 'NOW()' : 'NULL';
    await db.query(
      `UPDATE batch_deliveries
       SET status = ?, driver_notes = ?, delivered_at = ${deliveredAt}, updated_at = NOW()
       WHERE id = ?`,
      [status, driver_notes || null, req.params.id]
    );

    // ── After delivery: geocode remaining + return next stop ──
    const isTerminalStatus = ['delivered', 'not_found', 'address_mismatch', 'refused', 'returned'].includes(status);
    const lat = parseFloat(driver_lat);
    const lng = parseFloat(driver_lng);
    const hasGps = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

    if (isTerminalStatus && pkg.driver_id && hasGps) {
      // Run geocoding in background — do not await so response is fast
      geocodeDriverPackages(db, pkg.driver_id)
        .then((count) => {
          if (count > 0) {
            console.log(`[batch-geocode] driver ${pkg.driver_id}: geocoded ${count} new addresses`);
          }
        })
        .catch((err) => console.error('[batch-geocode] error:', err.message));

      // Find next nearest package (uses coords already in DB, geocoded packages
      // will appear in subsequent calls after background task completes)
      const nextStop = await findNextNearest(db, pkg.driver_id, lat, lng);

      // Count how many packages remain for this driver
      const [[remaining]] = await db.query(
        `SELECT COUNT(*) as total,
                SUM(lat != 0 AND lng != 0) as with_coords,
                SUM(lat = 0 OR lng = 0) as no_coords
         FROM batch_deliveries
         WHERE driver_id = ? AND status IN ('assigned', 'in_progress')`,
        [pkg.driver_id]
      );

      return res.json({
        success: true,
        message: 'Status updated',
        next_stop: nextStop,
        remaining: {
          total: Number(remaining.total),
          with_coords: Number(remaining.with_coords),
          geocoding_pending: Number(remaining.no_coords),
        },
      });
    }

    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('PATCH status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/batch-delivery/:id/photo
 * Save Cloudinary photo URL for proof of delivery.
 * Body: { photo_url }
 */
router.patch('/:id/photo', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const { photo_url } = req.body;
    if (!photo_url) return res.status(400).json({ success: false, message: 'photo_url is required' });

    await db.query(
      `UPDATE batch_deliveries SET delivery_photo_url = ?, updated_at = NOW() WHERE id = ?`,
      [photo_url, req.params.id]
    );

    res.json({ success: true, message: 'Photo saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/batch-delivery/:id/complete-delivery
 * Atomic endpoint: save proof photo and mark package as delivered in one transaction.
 * Body: { photo_url, driver_notes?, driver_lat?, driver_lng? }
 */
router.patch('/:id/complete-delivery', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  const { photo_url, driver_notes, driver_lat, driver_lng } = req.body || {};
  if (!photo_url) {
    return res.status(400).json({ success: false, message: 'photo_url is required' });
  }

  let conn = db;
  let shouldRelease = false;

  try {
    if (typeof db.getConnection === 'function') {
      conn = await db.getConnection();
      shouldRelease = true;
    }

    if (typeof conn.beginTransaction === 'function') {
      await conn.beginTransaction();
    }

    const [[pkg]] = await conn.query(
      `SELECT id, driver_id, status, npp, penerima
       FROM batch_deliveries
       WHERE id = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (!pkg) {
      if (typeof conn.rollback === 'function') await conn.rollback();
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    await conn.query(
      `UPDATE batch_deliveries
       SET delivery_photo_url = ?,
           status = 'delivered',
           driver_notes = ?,
           delivered_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [photo_url, driver_notes || null, req.params.id]
    );

    if (typeof conn.commit === 'function') {
      await conn.commit();
    }

    const lat = parseFloat(driver_lat);
    const lng = parseFloat(driver_lng);
    const hasGps = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

    if (pkg.driver_id && hasGps) {
      geocodeDriverPackages(conn, pkg.driver_id)
        .then((count) => {
          if (count > 0) {
            console.log(`[batch-geocode] driver ${pkg.driver_id}: geocoded ${count} new addresses`);
          }
        })
        .catch((err) => console.error('[batch-geocode] error:', err.message));

      const nextStop = await findNextNearest(conn, pkg.driver_id, lat, lng);
      const [[remaining]] = await conn.query(
        `SELECT COUNT(*) as total,
                SUM(lat != 0 AND lng != 0) as with_coords,
                SUM(lat = 0 OR lng = 0) as no_coords
         FROM batch_deliveries
         WHERE driver_id = ? AND status IN ('assigned', 'in_progress')`,
        [pkg.driver_id]
      );

      return res.json({
        success: true,
        message: 'Delivery completed',
        next_stop: nextStop,
        remaining: {
          total: Number(remaining.total),
          with_coords: Number(remaining.with_coords),
          geocoding_pending: Number(remaining.no_coords),
        },
      });
    }

    res.json({ success: true, message: 'Delivery completed' });
  } catch (error) {
    if (typeof conn.rollback === 'function') {
      try {
        await conn.rollback();
      } catch (_) {}
    }
    console.error('PATCH complete-delivery error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (shouldRelease && typeof conn.release === 'function') {
      conn.release();
    }
  }
});

/**
 * GET /api/batch-delivery/stats
 * Summary: total, per status, koordinat valid vs 0,0
 */
router.get('/stats', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const [[totals]] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'pending')          AS pending,
        SUM(status = 'assigned')         AS assigned,
        SUM(status = 'in_progress')      AS in_progress,
        SUM(status = 'delivered')        AS delivered,
        SUM(status = 'not_found')        AS not_found,
        SUM(status = 'address_mismatch') AS address_mismatch,
        SUM(status = 'refused')          AS refused,
        SUM(lat != 0 AND lng != 0)       AS has_coords,
        SUM(lat = 0 OR  lng = 0)         AS no_coords
      FROM batch_deliveries
    `);
    res.json({ success: true, data: totals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/batch-delivery/list
 * List packages with optional filters: status, wave, driver_id, no_coords
 */
router.get('/list', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    await ensureBatchDeliveryPicColumns(db);
    const { status, wave, driver_id, no_coords, page = 1, limit = 50 } = req.query;
    const where = [];
    const params = [];

    if (status)    { where.push('status = ?');    params.push(status); }
    if (wave)      { where.push('wave = ?');       params.push(wave); }
    if (driver_id) { where.push('driver_id = ?'); params.push(driver_id); }
    if (no_coords === '1') { where.push('(lat = 0 OR lng = 0)'); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
            `SELECT id, row_no, npp, recipient_address, lat, lng, wave, driver_id, status,
              penerima, batch_code, kawasan, nama_pic_penerima, nomor_hp_pic,
              delivery_photo_url, driver_notes, assigned_at, delivered_at, created_at
       FROM batch_deliveries ${whereClause}
       ORDER BY CAST(row_no AS UNSIGNED) ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM batch_deliveries ${whereClause}`,
      params
    );

    res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/batch-delivery/track/:npp
 * Public endpoint – cek resi batch delivery by NPP.
 * Returns status, address, coords, and driver_id for live tracking.
 */
router.get('/track/:npp', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    await ensureBatchDeliveryPicColumns(db);
    const { npp } = req.params;
    const [rows] = await db.query(
      `SELECT id, row_no, npp, recipient_address,
              lat, lng, wave, driver_id, status,
              penerima, batch_code, kawasan, nama_pic_penerima, nomor_hp_pic,
              delivery_photo_url, driver_notes,
              assigned_at, delivered_at, updated_at
       FROM batch_deliveries WHERE npp = ?`,
      [npp]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'NPP tidak ditemukan' });
    }
    res.json({ success: true, data: { ...rows[0], _type: 'batch' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/batch-delivery/customer/:customerId
 * Returns paginated batch deliveries for a specific customer (for landing page grid).
 */
router.get('/customer/:customerId', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    await ensureBatchDeliveryPicColumns(db);
    const { customerId } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = ['customer_id = ?'];
    const params = [customerId];
    if (status) { where.push('status = ?'); params.push(status); }
    const whereClause = 'WHERE ' + where.join(' AND ');

    const [rows] = await db.query(
            `SELECT id, row_no, npp, batch_code, penerima, recipient_address,
              lat, lng, status, kawasan, nama_pic_penerima, nomor_hp_pic,
              delivery_photo_url, driver_notes,
              assigned_at, delivered_at, updated_at
       FROM batch_deliveries ${whereClause}
       ORDER BY CAST(row_no AS UNSIGNED) ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM batch_deliveries ${whereClause}`,
      params
    );
    res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/batch-delivery/:id/location
 * Save a GPS location point for a batch delivery (called by driver nav screen).
 * Body: { driver_id, latitude, longitude }
 */
router.post('/:id/location', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    const { id } = req.params;
    const { driver_id, latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required' });
    }

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS batch_delivery_locations (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        batch_delivery_id BIGINT NOT NULL,
        driver_id INT,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_delivery (batch_delivery_id),
        INDEX idx_recorded (recorded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.query(
      `INSERT INTO batch_delivery_locations (batch_delivery_id, driver_id, latitude, longitude)
       VALUES (?, ?, ?, ?)`,
      [id, driver_id || null, latitude, longitude]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/batch-delivery/:id/route
 * Get stored GPS route points for a delivered batch item (for historical map).
 */
router.get('/:id/route', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    const { id } = req.params;

    // Return empty if table doesn't exist yet
    const [tables] = await db.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'batch_delivery_locations'`
    );
    if (tables.length === 0) {
      return res.json({ success: true, points: [] });
    }

    const [rows] = await db.query(
      `SELECT latitude, longitude, recorded_at
       FROM batch_delivery_locations
       WHERE batch_delivery_id = ?
       ORDER BY recorded_at ASC`,
      [id]
    );
    res.json({ success: true, points: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────
// KECAMATAN KABUPATEN TANGERANG (29 kecamatan)
// ─────────────────────────────────────────────
const KECAMATAN_KAB_TANGERANG = [
  'Balaraja', 'Cisauk', 'Cisoka', 'Cikupa', 'Curug',
  'Jambe', 'Jayanti', 'Kelapa Dua', 'Kemiri', 'Kosambi',
  'Kronjo', 'Kresek', 'Legok', 'Mauk', 'Mekar Baru',
  'Pagedangan', 'Pakuhaji', 'Panongan', 'Pasar Kemis', 'Rajeg',
  'Sepatan', 'Sepatan Timur', 'Sindang Jaya', 'Solear',
  'Sukadiri', 'Sukamulya', 'Tigaraksa', 'Teluknaga', 'Gunung Kaler'
];

// Helper: auto-create batch_delivery_jobs table
async function ensureBatchJobsTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS batch_delivery_jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pickup_name VARCHAR(255) NOT NULL,
      pickup_address TEXT NOT NULL,
      notes TEXT,
      batch_ids JSON,
      kecamatan_list JSON,
      status ENUM('open','accepted','completed','cancelled') DEFAULT 'open',
      driver_id INT DEFAULT NULL,
      accepted_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_driver (driver_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

/**
 * POST /api/batch-delivery/broadcast-job
 * Admin broadcast job ke driver berdasarkan kecamatan (Opsi B — tanpa ubah schema driver)
 * Body: { pickup_name, pickup_address, notes, batch_ids, kecamatan_list, secret }
 * Jika kecamatan_list kosong → otomatis pakai 29 kecamatan Kabupaten Tangerang
 */
router.post('/broadcast-job', async (req, res) => {
  const db = req.db;
  const {
    pickup_name, pickup_address, notes = '',
    batch_ids = [], kecamatan_list, secret
  } = req.body;

  const expectedSecret = process.env.BROADCAST_SECRET || 'hantar_admin';
  if (secret !== expectedSecret) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  if (!pickup_name || !pickup_address) {
    return res.status(400).json({ success: false, message: 'pickup_name dan pickup_address wajib diisi' });
  }

  try {
    await ensureBatchJobsTable(db);

    const targetKecamatan = (Array.isArray(kecamatan_list) && kecamatan_list.length > 0)
      ? kecamatan_list
      : KECAMATAN_KAB_TANGERANG;

    // Buat record job
    const [jobResult] = await db.query(
      `INSERT INTO batch_delivery_jobs 
        (pickup_name, pickup_address, notes, batch_ids, kecamatan_list, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'open', NOW(), NOW())`,
      [pickup_name, pickup_address, notes,
       JSON.stringify(batch_ids), JSON.stringify(targetKecamatan)]
    );
    const jobId = jobResult.insertId;

    // Cari driver aktif di kecamatan tersebut yang punya FCM token
    const placeholders = targetKecamatan.map(() => '?').join(',');
    const [drivers] = await db.query(
      `SELECT id, full_name, fcm_token 
       FROM independent_drivers 
       WHERE kecamatan IN (${placeholders})
         AND status = 'active'
         AND is_verified = 1`,
      targetKecamatan
    );

    const admin = require('firebase-admin');
    let pushSent = 0;
    let notifInserted = 0;
    const invalidTokens = [];

    const notifTitle = `📦 Ada Paket Siap Diambil!`;
    const notifBody = `Pickup di: ${pickup_name}. Klik untuk lihat detail.`;

    for (const driver of drivers) {
      // Simpan ke driver_notifications (bell in-app)
      try {
        await db.query(
          `INSERT INTO driver_notifications 
            (driver_id, type, title, message, data, is_read, created_at)
           VALUES (?, 'batch_job', ?, ?, ?, 0, NOW())`,
          [driver.id, notifTitle, notifBody,
           JSON.stringify({ job_id: jobId, pickup_name, pickup_address })]
        );
        notifInserted++;
      } catch (_) {}

      // Kirim FCM push notification
      if (driver.fcm_token) {
        try {
          await admin.messaging().send({
            token: driver.fcm_token,
            data: {
              type: 'batch_job',
              job_id: String(jobId),
              title: notifTitle,
              body: notifBody,
              pickup_name,
              pickup_address,
            },
            android: {
              priority: 'high',
              notification: { channelId: 'driver_channel', sound: 'default' },
            },
          });
          pushSent++;
        } catch (err) {
          const code = err?.errorInfo?.code || err?.code || '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(driver.fcm_token);
          }
        }
      }
    }

    // Bersihkan token tidak valid
    if (invalidTokens.length) {
      const ph = invalidTokens.map(() => '?').join(',');
      await db.query(
        `UPDATE independent_drivers SET fcm_token = NULL WHERE fcm_token IN (${ph})`,
        invalidTokens
      ).catch(() => {});
    }

    console.log(`📢 Broadcast job #${jobId}: drivers=${drivers.length}, pushSent=${pushSent}, notifInserted=${notifInserted}`);
    return res.json({
      success: true,
      job_id: jobId,
      drivers_found: drivers.length,
      push_sent: pushSent,
      notif_inserted: notifInserted,
      kecamatan_count: targetKecamatan.length,
    });

  } catch (err) {
    console.error('❌ broadcast-job error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/batch-delivery/available-jobs/:driverId
 * Driver lihat job yang tersedia (status open) di kecamatan mereka
 */
router.get('/available-jobs/:driverId', async (req, res) => {
  const db = req.db;
  const { driverId } = req.params;

  try {
    await ensureBatchJobsTable(db);

    // Ambil kecamatan driver
    const [driverRows] = await db.query(
      'SELECT id, full_name, kecamatan FROM independent_drivers WHERE id = ?',
      [driverId]
    );
    if (!driverRows.length) {
      return res.status(404).json({ success: false, message: 'Driver tidak ditemukan' });
    }
    const driver = driverRows[0];

    // Cari job open yang kecamatan driver ada di kecamatan_list job
    const [jobs] = await db.query(
      `SELECT id, pickup_name, pickup_address, notes, batch_ids, kecamatan_list, status, created_at
       FROM batch_delivery_jobs
       WHERE status = 'open'
       ORDER BY created_at DESC
       LIMIT 20`
    );

    // Filter: job yang include kecamatan driver
    const availableJobs = jobs.filter(job => {
      try {
        const list = typeof job.kecamatan_list === 'string'
          ? JSON.parse(job.kecamatan_list)
          : job.kecamatan_list;
        return Array.isArray(list) && list.includes(driver.kecamatan);
      } catch (_) { return false; }
    });

    return res.json({
      success: true,
      driver: { id: driver.id, full_name: driver.full_name, kecamatan: driver.kecamatan },
      jobs: availableJobs,
      total: availableJobs.length,
    });

  } catch (err) {
    console.error('❌ available-jobs error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/batch-delivery/accept-job
 * Driver terima job — assign job ke driver
 * Body: { driver_id, job_id }
 */
router.post('/accept-job', async (req, res) => {
  const db = req.db;
  const { driver_id, job_id } = req.body;

  if (!driver_id || !job_id) {
    return res.status(400).json({ success: false, message: 'driver_id dan job_id wajib diisi' });
  }

  try {
    await ensureBatchJobsTable(db);

    // Cek job masih open
    const [jobRows] = await db.query(
      'SELECT * FROM batch_delivery_jobs WHERE id = ? FOR UPDATE',
      [job_id]
    );
    if (!jobRows.length) {
      return res.status(404).json({ success: false, message: 'Job tidak ditemukan' });
    }
    const job = jobRows[0];
    if (job.status !== 'open') {
      return res.status(409).json({
        success: false,
        message: `Job sudah ${job.status === 'accepted' ? 'diambil driver lain' : job.status}`,
      });
    }

    // Assign ke driver
    await db.query(
      `UPDATE batch_delivery_jobs 
       SET status = 'accepted', driver_id = ?, accepted_at = NOW(), updated_at = NOW()
       WHERE id = ? AND status = 'open'`,
      [driver_id, job_id]
    );

    // Cek apakah berhasil (race condition guard)
    const [updated] = await db.query(
      'SELECT driver_id FROM batch_delivery_jobs WHERE id = ?',
      [job_id]
    );
    if (!updated.length || updated[0].driver_id != driver_id) {
      return res.status(409).json({ success: false, message: 'Job baru saja diambil driver lain' });
    }

    // Update batch_deliveries: assign driver ke paket
    if (job.batch_ids) {
      try {
        const batchIds = typeof job.batch_ids === 'string'
          ? JSON.parse(job.batch_ids)
          : job.batch_ids;
        if (Array.isArray(batchIds) && batchIds.length > 0) {
          const ph = batchIds.map(() => '?').join(',');
          await db.query(
            `UPDATE batch_deliveries SET driver_id = ?, updated_at = NOW()
             WHERE id IN (${ph})`,
            [driver_id, ...batchIds]
          );
        }
      } catch (_) {}
    }

    console.log(`✅ Job #${job_id} diterima oleh driver #${driver_id}`);
    return res.json({
      success: true,
      message: 'Job berhasil diterima! Silakan ambil paket di alamat pickup.',
      job: {
        id: job.id,
        pickup_name: job.pickup_name,
        pickup_address: job.pickup_address,
        notes: job.notes,
        batch_ids: job.batch_ids,
      },
    });

  } catch (err) {
    console.error('❌ accept-job error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

/**
 * GET /api/batch-delivery/next-stop
 * Driver requests their next nearest package from current GPS position.
 * Also triggers background geocoding for any packages without coords.
 *
 * Query params:
 *   driver_id   - required
 *   driver_lat  - required
 *   driver_lng  - required
 *   geocode     - '1' to trigger background geocoding of missing coords (default: '1')
 */
router.get('/next-stop', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const { driver_id, driver_lat, driver_lng, geocode = '1' } = req.query;

    if (!driver_id || !driver_lat || !driver_lng) {
      return res.status(400).json({
        success: false,
        message: 'driver_id, driver_lat, dan driver_lng wajib diisi',
      });
    }

    const lat = parseFloat(driver_lat);
    const lng = parseFloat(driver_lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'Koordinat tidak valid' });
    }

    // Background geocoding (non-blocking)
    if (geocode === '1') {
      geocodeDriverPackages(db, parseInt(driver_id))
        .then((count) => {
          if (count > 0) {
            console.log(`[next-stop geocode] driver ${driver_id}: geocoded ${count} addresses`);
          }
        })
        .catch((err) => console.error('[next-stop geocode] error:', err.message));
    }

    // Find next nearest with current coords in DB
    const nextStop = await findNextNearest(db, parseInt(driver_id), lat, lng);

    // Summary of remaining packages
    const [[remaining]] = await db.query(
      `SELECT COUNT(*) as total,
              SUM(lat != 0 AND lng != 0) as with_coords,
              SUM(lat = 0 OR lng = 0) as no_coords
       FROM batch_deliveries
       WHERE driver_id = ? AND status IN ('assigned', 'in_progress')`,
      [driver_id]
    );

    res.json({
      success: true,
      next_stop: nextStop,
      remaining: {
        total: Number(remaining.total),
        with_coords: Number(remaining.with_coords),
        geocoding_pending: Number(remaining.no_coords),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/batch-delivery/nearest
 * Hitung paket terdekat dari posisi driver saat ini menggunakan Haversine formula.
 *
 * Query params:
 *   driver_lat  - latitude posisi driver sekarang (required)
 *   driver_lng  - longitude posisi driver sekarang (required)
 *   driver_id   - filter hanya paket yang di-assign ke driver ini (optional)
 *   status      - filter status paket (default: 'assigned') - bisa multi: assigned,in_progress
 *   limit       - jumlah hasil yang dikembalikan (default: 10, max: 50)
 *
 * Response: array paket diurutkan dari jarak terpendek, dengan field distance_km
 *
 * Formula Haversine (radius bumi 6371 km):
 *   d = 6371 * ACOS(
 *         COS(RADIANS(driver_lat)) * COS(RADIANS(lat))
 *         * COS(RADIANS(lng) - RADIANS(driver_lng))
 *         + SIN(RADIANS(driver_lat)) * SIN(RADIANS(lat))
 *       )
 */
router.get('/nearest', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const { driver_lat, driver_lng, driver_id, status, limit = 10 } = req.query;

    if (!driver_lat || !driver_lng) {
      return res.status(400).json({
        success: false,
        message: 'driver_lat dan driver_lng wajib diisi',
      });
    }

    const lat = parseFloat(driver_lat);
    const lng = parseFloat(driver_lng);
    const maxLimit = Math.min(parseInt(limit) || 10, 50);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'driver_lat / driver_lng tidak valid',
      });
    }

    // Build WHERE conditions
    const where = [
      'lat != 0', // only rows with valid coords
      'lng != 0',
    ];
    const params = [lat, lng, lat]; // used in Haversine SELECT

    // Status filter — default: assigned dan in_progress
    const statusFilter = status
      ? status.split(',').map(s => s.trim())
      : ['assigned', 'in_progress'];
    where.push(`status IN (${statusFilter.map(() => '?').join(',')})`);
    params.push(...statusFilter);

    // Driver filter (only packages assigned to this specific driver)
    if (driver_id) {
      where.push('driver_id = ?');
      params.push(parseInt(driver_id));
    }

    params.push(maxLimit); // for LIMIT

    const whereClause = 'WHERE ' + where.join(' AND ');

    const [rows] = await db.query(
      `SELECT
         id, row_no, npp, batch_code, penerima,
         recipient_address, lat, lng,
         kawasan, nama_pic_penerima, nomor_hp_pic,
         status, driver_id, wave,
         ROUND(
           6371 * ACOS(
             COS(RADIANS(?)) * COS(RADIANS(lat))
             * COS(RADIANS(lng) - RADIANS(?))
             + SIN(RADIANS(?)) * SIN(RADIANS(lat))
           ), 3
         ) AS distance_km
       FROM batch_deliveries
       ${whereClause}
       ORDER BY distance_km ASC
       LIMIT ?`,
      params
    );

    res.json({
      success: true,
      driver_position: { lat, lng },
      total_found: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('nearest endpoint error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
