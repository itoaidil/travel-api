const express = require('express');
const router = express.Router();

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
          `INSERT IGNORE INTO batch_deliveries (row_no, npp, recipient_address, lat, lng, penerima)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [pkg.no || null, pkg.npp, pkg.address || '', lat, lng, pkg.penerima || null]
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
 * GET /api/batch-delivery/driver/:driverId
 * List packages assigned to a specific driver.
 * Query: status (optional), page, limit
 */
router.get('/driver/:driverId', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const { driverId } = req.params;
    const { status, page = 1, limit = 100 } = req.query;
    const where = ['driver_id = ?'];
    const params = [driverId];

    if (status) { where.push('status = ?'); params.push(status); }

    const whereClause = 'WHERE ' + where.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT id, row_no, npp, recipient_address, lat, lng, wave, status,
              penerima, batch_code, delivery_photo_url, driver_notes, assigned_at, delivered_at, updated_at
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
 * Body: { status, driver_notes }
 * Valid status: in_progress, delivered, not_found, address_mismatch, refused
 */
router.patch('/:id/status', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

  try {
    const { status, driver_notes } = req.body;
    const allowed = ['in_progress', 'delivered', 'not_found', 'address_mismatch', 'refused', 'returned'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    const deliveredAt = status === 'delivered' ? 'NOW()' : 'NULL';
    await db.query(
      `UPDATE batch_deliveries
       SET status = ?, driver_notes = ?, delivered_at = ${deliveredAt}, updated_at = NOW()
       WHERE id = ?`,
      [status, driver_notes || null, req.params.id]
    );

    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
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
              penerima, batch_code, delivery_photo_url, driver_notes, assigned_at, delivered_at, created_at
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
    const { npp } = req.params;
    const [rows] = await db.query(
      `SELECT id, row_no, npp, recipient_address,
              lat, lng, wave, driver_id, status,
              penerima, batch_code, delivery_photo_url, driver_notes,
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
    const { customerId } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = ['customer_id = ?'];
    const params = [customerId];
    if (status) { where.push('status = ?'); params.push(status); }
    const whereClause = 'WHERE ' + where.join(' AND ');

    const [rows] = await db.query(
      `SELECT id, row_no, npp, batch_code, penerima, recipient_address,
              lat, lng, status, delivery_photo_url, driver_notes,
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

module.exports = router;
