const express = require('express');
const router = express.Router();

/**
 * GET /api/admin/franchise/stats
 */
router.get('/franchise/stats', async (req, res) => {
  try {
    const db = req.db;

    const [rows] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive
      FROM franchise_partners
    `);

    return res.json({
      success: true,
      stats: rows[0] || { total: 0, pending: 0, active: 0, inactive: 0 }
    });
  } catch (error) {
    console.error('❌ Error getting franchise stats:', error);
    return res.status(500).json({ success: false, message: 'Failed to get franchise stats', error: error.message });
  }
});

/**
 * GET /api/admin/franchise/list?status=all|pending|active|inactive&search=...
 */
router.get('/franchise/list', async (req, res) => {
  try {
    const db = req.db;
    const status = (req.query.status || 'pending').toLowerCase();
    const search = (req.query.search || '').trim();

    const where = [];
    const params = [];

    if (status !== 'all') {
      where.push('fp.status = ?');
      params.push(status);
    }

    if (search) {
      where.push(`(
        fp.name LIKE ? OR
        fp.owner_name LIKE ? OR
        fp.phone LIKE ? OR
        fp.email LIKE ? OR
        fp.city LIKE ?
      )`);
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT
         fp.id,
         fp.name,
         fp.owner_name,
         fp.phone,
         fp.email,
         fp.city,
         fp.address,
         fp.commission_rate,
         fp.status,
         fp.notes,
         fp.created_at,
         fp.updated_at,
         COUNT(fca.id) AS coverage_count,
         GROUP_CONCAT(DISTINCT fca.kabupaten_name ORDER BY fca.kabupaten_name SEPARATOR ', ') AS coverage_areas
       FROM franchise_partners fp
       LEFT JOIN franchise_coverage_areas fca ON fca.franchise_partner_id = fp.id AND fca.is_active = 1
       ${whereSql}
       GROUP BY fp.id
       ORDER BY fp.created_at DESC`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('❌ Error getting franchise list:', error);
    return res.status(500).json({ success: false, message: 'Failed to get franchise list', error: error.message });
  }
});

/**
 * GET /api/admin/franchise/:id
 */
router.get('/franchise/:id', async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT id, name, owner_name, phone, email, city, address, commission_rate, status, notes, created_at, updated_at
       FROM franchise_partners
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Franchise not found' });
    }

    const [coverageRows] = await db.query(
      `SELECT id, kabupaten_name, is_active
       FROM franchise_coverage_areas
       WHERE franchise_partner_id = ?
       ORDER BY kabupaten_name ASC`,
      [id]
    );

    return res.json({ success: true, data: { ...rows[0], coverage_areas: coverageRows } });
  } catch (error) {
    console.error('❌ Error getting franchise detail:', error);
    return res.status(500).json({ success: false, message: 'Failed to get franchise detail', error: error.message });
  }
});

/**
 * POST /api/admin/franchise/:id/status
 * Body: { status: 'pending'|'active'|'inactive', notes?: string }
 */
router.post('/franchise/:id/status', async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['pending', 'active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [result] = await db.query(
      `UPDATE franchise_partners
       SET status = ?,
           notes = COALESCE(?, notes),
           updated_at = NOW()
       WHERE id = ?`,
      [status, notes || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Franchise not found' });
    }

    return res.json({ success: true, message: `Franchise status updated to ${status}` });
  } catch (error) {
    console.error('❌ Error updating franchise status:', error);
    return res.status(500).json({ success: false, message: 'Failed to update status', error: error.message });
  }
});

/**
 * PUT /api/admin/franchise/:id/commission
 * Body: { commission_rate: number }
 */
router.put('/franchise/:id/commission', async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const commissionRate = parseFloat(req.body.commission_rate);

    if (Number.isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
      return res.status(400).json({ success: false, message: 'commission_rate must be between 0 and 100' });
    }

    const [result] = await db.query(
      `UPDATE franchise_partners
       SET commission_rate = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [commissionRate, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Franchise not found' });
    }

    return res.json({ success: true, message: 'Commission rate updated successfully' });
  } catch (error) {
    console.error('❌ Error updating commission rate:', error);
    return res.status(500).json({ success: false, message: 'Failed to update commission rate', error: error.message });
  }
});

module.exports = router;
