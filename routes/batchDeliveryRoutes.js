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
          `INSERT IGNORE INTO batch_deliveries (row_no, npp, recipient_address, lat, lng)
           VALUES (?, ?, ?, ?, ?)`,
          [pkg.no || null, pkg.npp, pkg.address || '', lat, lng]
        );
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

module.exports = router;
