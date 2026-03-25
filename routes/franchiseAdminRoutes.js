const express = require('express');
const { verifyFranchiseAdminToken } = require('./franchiseAdminAuthRoutes');

const router = express.Router();

router.use(verifyFranchiseAdminToken);

function normalizeDateRange(from, to) {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 29 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null;
  }

  const fromSql = fromDate.toISOString().slice(0, 10);
  const toSql = toDate.toISOString().slice(0, 10);
  return { fromSql, toSql };
}

function parseFranchiseId(req, res) {
  const tokenFranchiseId = Number(req.franchiseAdmin?.franchisePartnerId || 0);
  const requestedFranchiseId = Number(req.query.franchise_partner_id || req.body?.franchise_partner_id || 0);

  if (requestedFranchiseId > 0 && requestedFranchiseId !== tokenFranchiseId) {
    res.status(403).json({
      success: false,
      message: 'franchise_partner_id does not match authenticated user'
    });
    return null;
  }

  const franchisePartnerId = tokenFranchiseId || requestedFranchiseId;
  if (!Number.isInteger(franchisePartnerId) || franchisePartnerId <= 0) {
    res.status(400).json({
      success: false,
      message: 'Authenticated franchise_partner_id is required and must be a positive integer'
    });
    return null;
  }

  return franchisePartnerId;
}

/**
 * GET /api/franchise-admin/dashboard?franchise_partner_id=1&from=2026-03-01&to=2026-03-31
 */
router.get('/dashboard', async (req, res) => {
  const db = req.db;
  if (!db) {
    return res.status(500).json({ success: false, message: 'Database not available' });
  }

  const franchisePartnerId = parseFranchiseId(req, res);
  if (!franchisePartnerId) return;

  const range = normalizeDateRange(req.query.from, req.query.to);
  if (!range) {
    return res.status(400).json({ success: false, message: 'Invalid date range' });
  }

  try {
    const [franchiseRows] = await db.query(
      'SELECT id, name, owner_name, city, status FROM franchise_partners WHERE id = ? LIMIT 1',
      [franchisePartnerId]
    );

    if (franchiseRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Franchise partner not found' });
    }

    const [kpiRows] = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN booking_status = 'completed' THEN total_price ELSE 0 END), 0) AS total_revenue,
         COALESCE(SUM(CASE WHEN booking_status = 'completed' THEN franchise_fee ELSE 0 END), 0) AS franchise_revenue,
         COALESCE(COUNT(CASE WHEN booking_status = 'completed' THEN 1 END), 0) AS total_transactions,
         COALESCE(COUNT(DISTINCT CASE WHEN booking_status = 'completed' THEN customer_id END), 0) AS customers_transacting,
         COALESCE(COUNT(DISTINCT CASE WHEN booking_status = 'completed' THEN driver_id END), 0) AS drivers_serving
       FROM independent_bookings
       WHERE franchise_partner_id = ?
         AND DATE(created_at) BETWEEN ? AND ?`,
      [franchisePartnerId, range.fromSql, range.toSql]
    );

    const [trendRows] = await db.query(
      `SELECT
         DATE(created_at) AS day,
         COALESCE(SUM(CASE WHEN booking_status = 'completed' THEN total_price ELSE 0 END), 0) AS revenue,
         COALESCE(COUNT(*), 0) AS orders
       FROM independent_bookings
       WHERE franchise_partner_id = ?
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       ORDER BY day ASC`,
      [franchisePartnerId, range.fromSql, range.toSql]
    );

    const [statusRows] = await db.query(
      `SELECT booking_status AS name, COUNT(*) AS value
       FROM independent_bookings
       WHERE franchise_partner_id = ?
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY booking_status`,
      [franchisePartnerId, range.fromSql, range.toSql]
    );

    const [topDriverRows] = await db.query(
      `SELECT
         ib.driver_id,
         COALESCE(d.full_name, ib.driver_name, CONCAT('Driver #', ib.driver_id)) AS name,
         COUNT(*) AS completed
       FROM independent_bookings ib
       LEFT JOIN independent_drivers d ON d.id = ib.driver_id
       WHERE ib.franchise_partner_id = ?
         AND ib.booking_status = 'completed'
         AND DATE(ib.created_at) BETWEEN ? AND ?
         AND ib.driver_id IS NOT NULL
       GROUP BY ib.driver_id, name
       ORDER BY completed DESC
       LIMIT 8`,
      [franchisePartnerId, range.fromSql, range.toSql]
    );

    const [areaRows] = await db.query(
      `SELECT
         fca.kabupaten_name AS area,
         COUNT(ib.id) AS orders,
         ROUND(
           (COUNT(ib.id) - COALESCE(prev.orders_prev, 0))
           / NULLIF(COALESCE(prev.orders_prev, 0), 0)
           * 100,
           2
         ) AS growth
       FROM franchise_coverage_areas fca
       LEFT JOIN independent_bookings ib
         ON ib.franchise_partner_id = fca.franchise_partner_id
        AND ib.pickup_address LIKE CONCAT('%', fca.kabupaten_name, '%')
        AND DATE(ib.created_at) BETWEEN ? AND ?
       LEFT JOIN (
         SELECT
           fca2.kabupaten_name,
           COUNT(ib2.id) AS orders_prev
         FROM franchise_coverage_areas fca2
         LEFT JOIN independent_bookings ib2
           ON ib2.franchise_partner_id = fca2.franchise_partner_id
          AND ib2.pickup_address LIKE CONCAT('%', fca2.kabupaten_name, '%')
          AND DATE(ib2.created_at) BETWEEN DATE_SUB(?, INTERVAL 30 DAY) AND DATE_SUB(?, INTERVAL 30 DAY)
         WHERE fca2.franchise_partner_id = ?
         GROUP BY fca2.kabupaten_name
       ) prev ON prev.kabupaten_name = fca.kabupaten_name
       WHERE fca.franchise_partner_id = ?
         AND fca.is_active = 1
       GROUP BY fca.kabupaten_name, prev.orders_prev
       ORDER BY orders DESC
       LIMIT 10`,
      [
        range.fromSql,
        range.toSql,
        range.fromSql,
        range.toSql,
        franchisePartnerId,
        franchisePartnerId
      ]
    );

    const kpi = kpiRows[0] || {
      total_revenue: 0,
      franchise_revenue: 0,
      total_transactions: 0,
      customers_transacting: 0,
      drivers_serving: 0
    };

    return res.json({
      success: true,
      data: {
        franchise: franchiseRows[0],
        range,
        kpi,
        revenue_trend: trendRows,
        status_breakdown: statusRows,
        top_drivers: topDriverRows,
        area_performance: areaRows.map((row) => ({
          area: row.area,
          orders: row.orders,
          growth: Number.isFinite(row.growth) ? row.growth : 0
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error getting franchise admin dashboard:', error);
    return res.status(500).json({ success: false, message: 'Failed to get dashboard data', error: error.message });
  }
});

/**
 * GET /api/franchise-admin/transactions?franchise_partner_id=1&page=1&limit=20&status=completed
 */
router.get('/transactions', async (req, res) => {
  const db = req.db;
  if (!db) {
    return res.status(500).json({ success: false, message: 'Database not available' });
  }

  const franchisePartnerId = parseFranchiseId(req, res);
  if (!franchisePartnerId) return;

  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const offset = (page - 1) * limit;
    const status = (req.query.status || 'all').toLowerCase();

    const where = ['franchise_partner_id = ?'];
    const params = [franchisePartnerId];

    if (status !== 'all') {
      where.push('booking_status = ?');
      params.push(status);
    }

    const whereSql = where.join(' AND ');

    const [rows] = await db.query(
      `SELECT
         id,
         booking_code,
         booking_type,
         customer_name,
         driver_name,
         pickup_address,
         dropoff_address,
         total_price,
         franchise_fee,
         booking_status,
         payment_status,
         created_at,
         completed_at
       FROM independent_bookings
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM independent_bookings
       WHERE ${whereSql}`,
      params
    );

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: countRows[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('❌ Error getting franchise transactions:', error);
    return res.status(500).json({ success: false, message: 'Failed to get transactions', error: error.message });
  }
});

/**
 * GET /api/franchise-admin/drivers?franchise_partner_id=1
 */
router.get('/drivers', async (req, res) => {
  const db = req.db;
  if (!db) {
    return res.status(500).json({ success: false, message: 'Database not available' });
  }

  const franchisePartnerId = parseFranchiseId(req, res);
  if (!franchisePartnerId) return;

  try {
    const [rows] = await db.query(
      `SELECT
         ib.driver_id,
         COALESCE(d.full_name, ib.driver_name, CONCAT('Driver #', ib.driver_id)) AS driver_name,
         MAX(d.phone) AS phone,
         MAX(d.vehicle_type) AS vehicle_type,
         COUNT(*) AS completed_orders,
         COALESCE(SUM(ib.driver_earnings), 0) AS total_earnings,
         MAX(ib.completed_at) AS last_completed_at
       FROM independent_bookings ib
       LEFT JOIN independent_drivers d ON d.id = ib.driver_id
       WHERE ib.franchise_partner_id = ?
         AND ib.driver_id IS NOT NULL
         AND ib.booking_status = 'completed'
       GROUP BY ib.driver_id, driver_name
       ORDER BY completed_orders DESC`,
      [franchisePartnerId]
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('❌ Error getting franchise drivers:', error);
    return res.status(500).json({ success: false, message: 'Failed to get drivers', error: error.message });
  }
});

/**
 * GET /api/franchise-admin/customers?franchise_partner_id=1
 */
router.get('/customers', async (req, res) => {
  const db = req.db;
  if (!db) {
    return res.status(500).json({ success: false, message: 'Database not available' });
  }

  const franchisePartnerId = parseFranchiseId(req, res);
  if (!franchisePartnerId) return;

  try {
    const [rows] = await db.query(
      `SELECT
         customer_id,
         MAX(customer_name) AS customer_name,
         MAX(customer_phone) AS customer_phone,
         COUNT(*) AS transactions,
         COALESCE(SUM(CASE WHEN booking_status = 'completed' THEN total_price ELSE 0 END), 0) AS gross_spend,
         MAX(created_at) AS last_transaction_at
       FROM independent_bookings
       WHERE franchise_partner_id = ?
         AND customer_id IS NOT NULL
       GROUP BY customer_id
       ORDER BY transactions DESC, gross_spend DESC`,
      [franchisePartnerId]
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('❌ Error getting franchise customers:', error);
    return res.status(500).json({ success: false, message: 'Failed to get customers', error: error.message });
  }
});

module.exports = router;
