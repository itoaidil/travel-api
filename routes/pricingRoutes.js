const express = require('express');
const router = express.Router();

// Default fallback pricing per service + vehicle (same as Flutter fallback)
const DEFAULT_PRICING = {
  instant_ride:  { base_fare: 5000, per_km: 3000 },
  ride:          { base_fare: 5000, per_km: 3000 },
  antar_paket:   { base_fare: 0, per_km: 1800 },
  delivery:      { base_fare: 0, per_km: 1800 },
  cargo:         { base_fare: 10000, per_km: 4000 },
};

// Map Flutter serviceCode → promo service_type in promo_rules table
const SERVICE_CODE_TO_PROMO_TYPE = {
  instant_ride: 'ride',
  ride:         'ride',
  antar_paket:  'antar_paket',
  delivery:     'delivery',
  cargo:        null, // no promo for cargo
};

/**
 * GET /api/pricing/calculate
 * Query params: serviceCode, vehicleType, distance (km)
 *
 * Returns fare estimate with promo applied if eligible.
 * Response:
 * {
 *   success: true,
 *   total_fare: 0,          ← customer pays this
 *   normal_fare: 14642,     ← original price (for display / driver payout)
 *   promo_applied: true,
 *   promo_code: "FREE5KM_RIDE",
 *   promo_name: "Gratis Ongkos Antar Penumpang <= 5 KM"
 * }
 */
router.get('/calculate', async (req, res) => {
  const db = req.db;
  const { serviceCode = 'instant_ride', vehicleType = 'motorcycle', distance } = req.query;

  const distanceKm = parseFloat(distance) || 0;
  if (distanceKm <= 0) {
    return res.status(400).json({ success: false, message: 'distance query param required' });
  }

  // Calculate base fare
  const pricingKey = serviceCode.toLowerCase();
  const pricing = DEFAULT_PRICING[pricingKey] || DEFAULT_PRICING['instant_ride'];
  let normalFare = Math.round(pricing.base_fare + distanceKm * pricing.per_km);

  // Try to get fare from DB pricing table if available
  if (db) {
    try {
      const [rows] = await db.query(
        `SELECT base_fare, per_km_rate
         FROM service_vehicle_pricing
         WHERE (service_code = ? OR vehicle_type = ?)
           AND is_active = 1
         LIMIT 1`,
        [serviceCode, vehicleType]
      );
      if (rows.length > 0 && rows[0].base_fare != null) {
        normalFare = Math.round(
          parseFloat(rows[0].base_fare) + distanceKm * parseFloat(rows[0].per_km_rate || 3000)
        );
      }
    } catch (_) {
      // Pricing table may not exist yet — use default
    }
  }

  // Check active promo
  let finalFare = normalFare;
  let promoApplied = false;
  let promoCode = null;
  let promoName = null;

  const promoServiceType = SERVICE_CODE_TO_PROMO_TYPE[pricingKey];

  if (db && promoServiceType) {
    try {
      const [promoRows] = await db.query(
        `SELECT id, promo_code, promo_name, promo_type, max_distance_km
         FROM promo_rules
         WHERE is_active = 1
           AND service_type = ?
           AND start_at <= NOW()
           AND end_at   >= NOW()
           AND (max_distance_km IS NULL OR ? <= max_distance_km)
         ORDER BY max_distance_km ASC
         LIMIT 1`,
        [promoServiceType, distanceKm]
      );

      if (promoRows.length > 0) {
        const promo = promoRows[0];
        if (promo.promo_type === 'free_fare') {
          finalFare = 0;
        } else if (promo.promo_type === 'fixed') {
          finalFare = Math.max(0, normalFare - parseFloat(promo.promo_value || 0));
        } else if (promo.promo_type === 'percentage') {
          finalFare = Math.round(normalFare * (1 - parseFloat(promo.promo_value || 0) / 100));
        }
        promoApplied = true;
        promoCode = promo.promo_code;
        promoName = promo.promo_name;
      }
    } catch (_) {
      // promo_rules table may not exist yet — no promo
    }
  }

  return res.json({
    success: true,
    total_fare: finalFare,
    normal_fare: normalFare,
    promo_applied: promoApplied,
    promo_code: promoCode,
    promo_name: promoName,
    distance_km: distanceKm,
    service_code: serviceCode,
    vehicle_type: vehicleType,
  });
});

module.exports = router;
