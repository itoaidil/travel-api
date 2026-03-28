const express = require('express');
const router = express.Router();

/**
 * GET /api/promo/active
 * Returns currently active promo(s) for the customer app.
 * Customer app uses this to decide whether to show a promo popup.
 *
 * Response when promo is active:
 *   { active: true, promos: [{ promo_code, promo_name, promo_type, max_distance_km, end_at, notes }] }
 *
 * Response when no promo is active:
 *   { active: false, promos: [] }
 */
router.get('/active', async (req, res) => {
  const db = req.db;
  if (!db) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }

  try {
    const [rows] = await db.query(
      `SELECT
         promo_code,
         promo_name,
         service_type,
         promo_type,
         max_distance_km,
         end_at,
         notes
       FROM promo_rules
       WHERE is_active = 1
         AND start_at <= NOW()
         AND end_at   >= NOW()
       ORDER BY id DESC`
    );

    return res.json({
      success: true,
      active: rows.length > 0,
      promos: rows,
    });
  } catch (error) {
    // If promo tables haven't been created yet, return no promo (graceful degradation)
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, active: false, promos: [] });
    }
    console.error('GET /api/promo/active error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/promo/active?service_type=delivery
 * Optionally filter by service type.
 */
router.get('/active/:serviceType', async (req, res) => {
  const db = req.db;
  const { serviceType } = req.params;

  if (!db) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }

  try {
    const [rows] = await db.query(
      `SELECT
         promo_code,
         promo_name,
         service_type,
         promo_type,
         max_distance_km,
         end_at,
         notes
       FROM promo_rules
       WHERE is_active = 1
         AND service_type = ?
         AND start_at <= NOW()
         AND end_at   >= NOW()
       ORDER BY id DESC`,
      [serviceType]
    );

    return res.json({
      success: true,
      active: rows.length > 0,
      promos: rows,
    });
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, active: false, promos: [] });
    }
    console.error('GET /api/promo/active/:serviceType error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/promo/seed
 * One-time seed: insert default FREE5KM promo.
 * Protected by ADMIN_SECRET header to prevent unauthorized access.
 *
 * Example:
 *   curl -X POST https://your-api/api/promo/seed \
 *     -H "x-admin-secret: <ADMIN_SECRET>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"end_at": "2026-04-30 23:59:59"}'
 */
router.post('/seed', async (req, res) => {
  const db = req.db;
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (!db) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }

  const endAt = req.body.end_at || '2026-04-30 23:59:59';

  try {
    // Insert for delivery
    await db.query(
      `INSERT INTO promo_rules
         (promo_code, promo_name, service_type, promo_type, promo_value, max_distance_km, is_active, start_at, end_at, notes)
       VALUES (?, ?, 'delivery', 'free_fare', 0, 5.00, 1, NOW(), ?, ?)
       ON DUPLICATE KEY UPDATE end_at = VALUES(end_at), is_active = 1, updated_at = NOW()`,
      [
        'FREE5KM_DELIVERY',
        'Gratis Ongkir Delivery <= 5 KM',
        endAt,
        'Promo customer Rp0, harga normal tercatat untuk payout driver',
      ]
    );

    // Insert for antar_paket
    await db.query(
      `INSERT INTO promo_rules
         (promo_code, promo_name, service_type, promo_type, promo_value, max_distance_km, is_active, start_at, end_at, notes)
       VALUES (?, ?, 'antar_paket', 'free_fare', 0, 5.00, 1, NOW(), ?, ?)
       ON DUPLICATE KEY UPDATE end_at = VALUES(end_at), is_active = 1, updated_at = NOW()`,
      [
        'FREE5KM_ANTAR_PAKET',
        'Gratis Ongkir Antar Paket <= 5 KM',
        endAt,
        'Promo customer Rp0, harga normal tercatat untuk payout driver',
      ]
    );

    return res.json({ success: true, message: 'Promo seeded', end_at: endAt });
  } catch (error) {
    console.error('POST /api/promo/seed error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
