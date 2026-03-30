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
  const [kabupatenColumn] = await db.query(
    'SHOW COLUMNS FROM batch_deliveries LIKE ?',
    ['nama_kabupaten']
  );
  const namePicPosition = kabupatenColumn.length > 0 ? 'AFTER nama_kabupaten' : 'AFTER kawasan';

  const requiredColumns = [
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
             row_no, npp, recipient_address, lat, lng, penerima,
             nama_pic_penerima, nomor_hp_pic
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pkg.no || null,
            pkg.npp,
            pkg.address || '',
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
 * GET /api/batch-delivery/assigned-list
 * List assigned packages for dispatch operations.
 * Query: driver_id (optional), kawasan (optional), limit (optional)
 */
router.get('/assigned-list', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const { driver_id, kawasan, limit = 300 } = req.query;
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

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const whereClause = `WHERE ${where.join(' AND ')}`;

    const [rows] = await db.query(
      `SELECT
         bd.id,
         bd.npp,
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
       LIMIT ?`,
      [...params, safeLimit]
    );

    res.json({ success: true, data: rows, limit: safeLimit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/batch-delivery/reassign
 * Reassign packages to another driver.
 * Mode A (per package): { target_driver_id, package_ids: [1,2,3] }
 * Mode B (per kawasan): { target_driver_id, source_driver_id, kawasan }
 */
router.post('/reassign', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const {
      target_driver_id,
      package_ids,
      source_driver_id,
      kawasan,
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

    if (Array.isArray(package_ids) && package_ids.length > 0) {
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
      if (!fromDriver || !kawasan) {
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
