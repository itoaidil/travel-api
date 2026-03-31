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

const DEFAULT_SERVICE_TIERS = [
  {
    code: 'ngebut',
    label: 'Ngebut',
    description: 'Driver khusus, lebih cepat sampai',
    multiplier: 1.4,
    sort_order: 1,
  },
  {
    code: 'normal',
    label: 'Normal',
    description: 'Pengiriman standar',
    multiplier: 1.0,
    sort_order: 2,
  },
  {
    code: 'bareng',
    label: 'Bareng',
    description: 'Hemat biaya, waktu tunggu sedikit lebih lama',
    multiplier: 0.8,
    sort_order: 3,
  },
];

function normalizeVehicleType(vehicleType) {
  const value = String(vehicleType || '').toLowerCase();
  if (value === 'motor') return 'motorcycle';
  if (value === 'sepeda') return 'bike';
  return value;
}

async function resolveBaseFareFromPricingTable(db, serviceCode, vehicleType, distanceKm) {
  const service = String(serviceCode || '').toLowerCase();
  const serviceAlt = service === 'antar_paket' ? 'delivery' : service;
  const vehicleRaw = String(vehicleType || '').toLowerCase();
  const vehicle = normalizeVehicleType(vehicleRaw);

  // Priority 1: exact service + exact/normalized vehicle
  const [exactRows] = await db.query(
    `SELECT base_fare, per_km_rate
     FROM service_vehicle_pricing
     WHERE is_active = 1
       AND service_code IN (?, ?)
       AND vehicle_type IN (?, ?)
     ORDER BY (service_code = ?) DESC, (vehicle_type = ?) DESC
     LIMIT 1`,
    [service, serviceAlt, vehicleRaw, vehicle, service, vehicle]
  );
  if (exactRows.length > 0 && exactRows[0].base_fare != null) {
    return Math.round(
      parseFloat(exactRows[0].base_fare || 0) +
        distanceKm * parseFloat(exactRows[0].per_km_rate || 0)
    );
  }

  // Priority 2: service only
  const [serviceRows] = await db.query(
    `SELECT base_fare, per_km_rate
     FROM service_vehicle_pricing
     WHERE is_active = 1
       AND service_code IN (?, ?)
     ORDER BY (service_code = ?) DESC
     LIMIT 1`,
    [service, serviceAlt, service]
  );
  if (serviceRows.length > 0 && serviceRows[0].base_fare != null) {
    return Math.round(
      parseFloat(serviceRows[0].base_fare || 0) +
        distanceKm * parseFloat(serviceRows[0].per_km_rate || 0)
    );
  }

  // Priority 3: vehicle only
  const [vehicleRows] = await db.query(
    `SELECT base_fare, per_km_rate
     FROM service_vehicle_pricing
     WHERE is_active = 1
       AND vehicle_type IN (?, ?)
     ORDER BY (vehicle_type = ?) DESC
     LIMIT 1`,
    [vehicleRaw, vehicle, vehicle]
  );
  if (vehicleRows.length > 0 && vehicleRows[0].base_fare != null) {
    return Math.round(
      parseFloat(vehicleRows[0].base_fare || 0) +
        distanceKm * parseFloat(vehicleRows[0].per_km_rate || 0)
    );
  }

  return null;
}

async function getActiveServiceTiers(db) {
  if (!db) return DEFAULT_SERVICE_TIERS;
  try {
    const [rows] = await db.query(
      `SELECT code, label, description, multiplier, sort_order
       FROM service_tiers
       WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`
    );
    if (!rows || rows.length === 0) return DEFAULT_SERVICE_TIERS;
    return rows.map((row) => ({
      code: String(row.code || '').toLowerCase(),
      label: row.label || row.code,
      description: row.description || null,
      multiplier: parseFloat(row.multiplier || 1),
      sort_order: Number(row.sort_order || 0),
    }));
  } catch (_) {
    return DEFAULT_SERVICE_TIERS;
  }
}

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
  const {
    serviceCode = 'instant_ride',
    vehicleType = 'motorcycle',
    serviceTier = 'normal',
    distance,
  } = req.query;

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
      const resolvedFare = await resolveBaseFareFromPricingTable(
        db,
        pricingKey,
        vehicleType,
        distanceKm
      );
      if (resolvedFare != null) normalFare = resolvedFare;
    } catch (_) {
      // Pricing table may not exist yet — use default
    }
  }

  // Check active promo
  let promoBaseFare = normalFare;
  let promoApplied = false;
  let promoCode = null;
  let promoName = null;

  const promoServiceType = SERVICE_CODE_TO_PROMO_TYPE[pricingKey];

  if (db && promoServiceType) {
    try {
      const [promoRows] = await db.query(
        `SELECT id, promo_code, promo_name, promo_type, promo_value, max_distance_km
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
          promoBaseFare = 0;
        } else if (promo.promo_type === 'fixed') {
          promoBaseFare = Math.max(0, normalFare - parseFloat(promo.promo_value || 0));
        } else if (promo.promo_type === 'percentage') {
          promoBaseFare = Math.round(normalFare * (1 - parseFloat(promo.promo_value || 0) / 100));
        }
        promoApplied = true;
        promoCode = promo.promo_code;
        promoName = promo.promo_name;
      }
    } catch (_) {
      // promo_rules table may not exist yet — no promo
    }
  }

  const activeTiers = await getActiveServiceTiers(db);
  const tiers = activeTiers.map((tier) => {
    const originalPrice = Math.max(0, Math.round(normalFare * (tier.multiplier || 1)));
    const finalPrice = Math.max(0, Math.round(promoBaseFare * (tier.multiplier || 1)));
    return {
      code: tier.code,
      label: tier.label,
      description: tier.description,
      multiplier: tier.multiplier,
      sort_order: tier.sort_order,
      original_price: originalPrice,
      final_price: finalPrice,
      discount_amount: Math.max(0, originalPrice - finalPrice),
    };
  });

  const selectedTierCode = String(serviceTier || 'normal').toLowerCase();
  const selectedTier =
    tiers.find((tier) => tier.code === selectedTierCode) ||
    tiers.find((tier) => tier.code === 'normal') ||
    tiers[0];

  const finalFare = selectedTier ? selectedTier.final_price : promoBaseFare;
  const originalFare = selectedTier ? selectedTier.original_price : normalFare;

  return res.json({
    success: true,
    total_fare: finalFare,
    normal_fare: originalFare,
    original_fare: originalFare,
    selected_tier: selectedTier ? selectedTier.code : 'normal',
    promo_applied: promoApplied,
    promo_code: promoCode,
    promo_name: promoName,
    distance_km: distanceKm,
    service_code: serviceCode,
    vehicle_type: vehicleType,
    tiers,
  });
});

router.get('/tiers', async (req, res) => {
  const tiers = await getActiveServiceTiers(req.db);
  return res.json({ success: true, data: tiers });
});

module.exports = router;
