const express = require('express');
const router = express.Router();
const axios = require('axios');

const PILOT_CONFIG = {
  area: 'Kabupaten Tangerang',
  bicycle_max_distance_km: 5,
  pricing_source: 'db_formula_v1',
};

const DEFAULT_SERVICE_PRICING = [
  {
    service_type: 'regular',
    vehicle_type: 'bicycle',
    transport_mode: 'land',
    sla_min_hours: 24,
    sla_max_hours: 48,
    volumetric_divisor: 4000,
    base_fee: 0,
    rate_per_km: 800,
    rate_per_kg: 2500,
    insurance_fee_flat: 0,
    insurance_fee_percent: 0,
    fuel_surcharge_percent: 0,
    handling_fee: 0,
    driver_commission_type: 'fixed',
    driver_commission_value: 4000,
  },
  {
    service_type: 'regular',
    vehicle_type: 'motorcycle',
    transport_mode: 'land',
    sla_min_hours: 12,
    sla_max_hours: 24,
    volumetric_divisor: 4000,
    base_fee: 0,
    rate_per_km: 1200,
    rate_per_kg: 3000,
    insurance_fee_flat: 0,
    insurance_fee_percent: 0,
    fuel_surcharge_percent: 0,
    handling_fee: 0,
    driver_commission_type: 'fixed',
    driver_commission_value: 8000,
  },
  {
    service_type: 'same_day',
    vehicle_type: 'bicycle',
    transport_mode: 'land',
    sla_min_hours: 8,
    sla_max_hours: 12,
    volumetric_divisor: 4000,
    base_fee: 2000,
    rate_per_km: 1000,
    rate_per_kg: 3000,
    insurance_fee_flat: 0,
    insurance_fee_percent: 0,
    fuel_surcharge_percent: 0,
    handling_fee: 0,
    driver_commission_type: 'fixed',
    driver_commission_value: 5000,
  },
  {
    service_type: 'same_day',
    vehicle_type: 'motorcycle',
    transport_mode: 'land',
    sla_min_hours: 4,
    sla_max_hours: 8,
    volumetric_divisor: 4000,
    base_fee: 3000,
    rate_per_km: 1500,
    rate_per_kg: 4000,
    insurance_fee_flat: 0,
    insurance_fee_percent: 0,
    fuel_surcharge_percent: 0,
    handling_fee: 0,
    driver_commission_type: 'fixed',
    driver_commission_value: 9000,
  },
];

const DEFAULT_MINIMUM_CHARGE = [
  { service_type: 'regular', vehicle_type: 'bicycle', minimum_charge: 10000 },
  { service_type: 'regular', vehicle_type: 'motorcycle', minimum_charge: 20000 },
  { service_type: 'same_day', vehicle_type: 'bicycle', minimum_charge: 15000 },
  { service_type: 'same_day', vehicle_type: 'motorcycle', minimum_charge: 25000 },
];

/**
 * Titik asal ekspedisi (kantor Hantar).
 * Di masa depan ini bisa dipindah ke tabel expedition_offices di DB.
 */
const HANTAR_OFFICE = {
  name: 'Hantar Ekspedisi - Kantor Utama',
  phone: '',
  address: 'Jalan Ciliwung Raya, Bumi Cibinong Endah',
  kecamatan: 'Cibinong',
  kabupaten: 'Kab. Bogor',
  provinsi: 'Jawa Barat',
  postal_code: '16913',
  lat: -6.4793112,
  lon: 106.8168858,
};

function normalizeVehicleType(vehicleType = '') {
  const v = String(vehicleType).toLowerCase();
  if (v === 'sepeda' || v === 'bicycle' || v === 'bike') return 'bicycle';
  if (v === 'motor' || v === 'motorcycle') return 'motorcycle';
  return null;
}

function normalizeServiceType(serviceType = '') {
  const s = String(serviceType || '').trim().toLowerCase();
  return s || 'regular';
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundToInt(value) {
  return Math.max(0, Math.round(toNumber(value, 0)));
}

function buildTrackingNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `HTR-EXP-${y}${m}${d}${h}${min}-${rand}`;
}

async function ensureExpeditionTables(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS expedition_shipments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tracking_number VARCHAR(50) NOT NULL UNIQUE,
      area VARCHAR(120) NOT NULL DEFAULT 'Kabupaten Tangerang',
      service_type VARCHAR(40) NOT NULL DEFAULT 'regular',
      vehicle_type ENUM('bicycle','motorcycle') NOT NULL,

      sender_name VARCHAR(120) NOT NULL,
      sender_phone VARCHAR(30) NOT NULL,
      sender_address TEXT NOT NULL,
      sender_kecamatan VARCHAR(120) NULL,
      sender_kelurahan VARCHAR(120) NULL,
      sender_kabupaten VARCHAR(120) NULL,
      sender_provinsi VARCHAR(120) NULL,
      sender_postal_code VARCHAR(10) NULL,

      recipient_name VARCHAR(120) NOT NULL,
      recipient_phone VARCHAR(30) NOT NULL,
      recipient_address TEXT NOT NULL,
      recipient_kecamatan VARCHAR(120) NULL,
      recipient_kelurahan VARCHAR(120) NULL,
      recipient_kabupaten VARCHAR(120) NULL,
      recipient_provinsi VARCHAR(120) NULL,
      recipient_postal_code VARCHAR(10) NULL,

      distance_km DECIMAL(8,2) NOT NULL,
      weight_kg DECIMAL(8,2) NULL,
      volumetric_weight_kg DECIMAL(10,2) NULL,
      chargeable_weight_kg DECIMAL(10,2) NULL,
      length_cm DECIMAL(8,2) NULL,
      width_cm DECIMAL(8,2) NULL,
      height_cm DECIMAL(8,2) NULL,

      insurance_enabled TINYINT(1) NOT NULL DEFAULT 0,
      pickup_type ENUM('pickup','drop_point') NOT NULL DEFAULT 'pickup',

      customer_price INT NOT NULL,
      driver_commission INT NOT NULL,
      platform_margin INT NOT NULL,
      pricing_breakdown_json JSON NULL,

      status ENUM('created','scheduled','picked_up','in_transit','delivered','failed','returned') NOT NULL DEFAULT 'created',
      notes TEXT NULL,
      created_by VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_status (status),
      INDEX idx_vehicle (vehicle_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migrate: add kabupaten/provinsi columns if they don't exist yet (MySQL 8+)
  const migrationCols = [
    `ALTER TABLE expedition_shipments ADD COLUMN IF NOT EXISTS sender_kabupaten VARCHAR(120) NULL AFTER sender_kecamatan`,
    `ALTER TABLE expedition_shipments ADD COLUMN IF NOT EXISTS sender_provinsi VARCHAR(120) NULL AFTER sender_kabupaten`,
    `ALTER TABLE expedition_shipments ADD COLUMN IF NOT EXISTS recipient_kabupaten VARCHAR(120) NULL AFTER recipient_kecamatan`,
    `ALTER TABLE expedition_shipments ADD COLUMN IF NOT EXISTS recipient_provinsi VARCHAR(120) NULL AFTER recipient_kabupaten`,
    `ALTER TABLE expedition_shipments ADD COLUMN IF NOT EXISTS volumetric_weight_kg DECIMAL(10,2) NULL AFTER weight_kg`,
    `ALTER TABLE expedition_shipments ADD COLUMN IF NOT EXISTS chargeable_weight_kg DECIMAL(10,2) NULL AFTER volumetric_weight_kg`,
    `ALTER TABLE expedition_shipments ADD COLUMN IF NOT EXISTS pricing_breakdown_json JSON NULL AFTER platform_margin`,
  ];
  for (const sql of migrationCols) {
    await db.query(sql).catch(() => {});
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS expedition_service_pricing (
      id INT AUTO_INCREMENT PRIMARY KEY,
      service_type VARCHAR(40) NOT NULL,
      vehicle_type ENUM('bicycle','motorcycle') NOT NULL,
      transport_mode ENUM('land','sea') NOT NULL DEFAULT 'land',
      sla_min_hours INT NULL,
      sla_max_hours INT NULL,
      volumetric_divisor INT NOT NULL DEFAULT 4000,
      base_fee INT NOT NULL DEFAULT 0,
      rate_per_km INT NOT NULL DEFAULT 0,
      rate_per_kg INT NOT NULL DEFAULT 0,
      insurance_fee_flat INT NOT NULL DEFAULT 0,
      insurance_fee_percent DECIMAL(6,2) NOT NULL DEFAULT 0,
      fuel_surcharge_percent DECIMAL(6,2) NOT NULL DEFAULT 0,
      handling_fee INT NOT NULL DEFAULT 0,
      driver_commission_type ENUM('fixed','percentage') NOT NULL DEFAULT 'fixed',
      driver_commission_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_service_vehicle (service_type, vehicle_type),
      INDEX idx_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS expedition_minimum_charge_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      service_type VARCHAR(40) NOT NULL,
      vehicle_type ENUM('all','bicycle','motorcycle') NOT NULL DEFAULT 'all',
      minimum_charge INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_service_vehicle_min (service_type, vehicle_type),
      INDEX idx_min_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  for (const row of DEFAULT_SERVICE_PRICING) {
    await db.query(
      `INSERT INTO expedition_service_pricing (
        service_type, vehicle_type, transport_mode,
        sla_min_hours, sla_max_hours,
        volumetric_divisor, base_fee, rate_per_km, rate_per_kg,
        insurance_fee_flat, insurance_fee_percent,
        fuel_surcharge_percent, handling_fee,
        driver_commission_type, driver_commission_value,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        transport_mode = VALUES(transport_mode),
        sla_min_hours = VALUES(sla_min_hours),
        sla_max_hours = VALUES(sla_max_hours),
        volumetric_divisor = VALUES(volumetric_divisor),
        base_fee = VALUES(base_fee),
        rate_per_km = VALUES(rate_per_km),
        rate_per_kg = VALUES(rate_per_kg),
        insurance_fee_flat = VALUES(insurance_fee_flat),
        insurance_fee_percent = VALUES(insurance_fee_percent),
        fuel_surcharge_percent = VALUES(fuel_surcharge_percent),
        handling_fee = VALUES(handling_fee),
        driver_commission_type = VALUES(driver_commission_type),
        driver_commission_value = VALUES(driver_commission_value),
        is_active = 1`,
      [
        row.service_type,
        row.vehicle_type,
        row.transport_mode,
        row.sla_min_hours,
        row.sla_max_hours,
        row.volumetric_divisor,
        row.base_fee,
        row.rate_per_km,
        row.rate_per_kg,
        row.insurance_fee_flat,
        row.insurance_fee_percent,
        row.fuel_surcharge_percent,
        row.handling_fee,
        row.driver_commission_type,
        row.driver_commission_value,
      ]
    );
  }

  for (const row of DEFAULT_MINIMUM_CHARGE) {
    await db.query(
      `INSERT INTO expedition_minimum_charge_rules (
        service_type, vehicle_type, minimum_charge, is_active
      ) VALUES (?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        minimum_charge = VALUES(minimum_charge),
        is_active = 1`,
      [row.service_type, row.vehicle_type, row.minimum_charge]
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS expedition_shipment_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shipment_id INT NOT NULL,
      event_code VARCHAR(50) NOT NULL,
      event_label VARCHAR(120) NOT NULL,
      event_notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_shipment (shipment_id),
      INDEX idx_event_code (event_code),
      CONSTRAINT fk_expedition_event_shipment
        FOREIGN KEY (shipment_id) REFERENCES expedition_shipments(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getServicePricing(db, serviceType, vehicleType) {
  const normalizedService = normalizeServiceType(serviceType);

  const [exactRows] = await db.query(
    `SELECT *
     FROM expedition_service_pricing
     WHERE service_type = ? AND vehicle_type = ? AND is_active = 1
     LIMIT 1`,
    [normalizedService, vehicleType]
  );
  if (exactRows.length) return exactRows[0];

  const [fallbackRows] = await db.query(
    `SELECT *
     FROM expedition_service_pricing
     WHERE service_type = 'regular' AND vehicle_type = ? AND is_active = 1
     LIMIT 1`,
    [vehicleType]
  );
  if (fallbackRows.length) return fallbackRows[0];

  throw new Error('Konfigurasi tarif layanan tidak ditemukan');
}

async function getMinimumCharge(db, serviceType, vehicleType) {
  const normalizedService = normalizeServiceType(serviceType);

  const [rows] = await db.query(
    `SELECT minimum_charge
     FROM expedition_minimum_charge_rules
     WHERE is_active = 1
       AND service_type IN (?, 'all')
       AND vehicle_type IN (?, 'all')
     ORDER BY
       (service_type = ?) DESC,
       (vehicle_type = ?) DESC
     LIMIT 1`,
    [normalizedService, vehicleType, normalizedService, vehicleType]
  );

  return rows.length ? toNumber(rows[0].minimum_charge, 0) : 0;
}

function calculatePriceByFormula({
  distanceKm,
  weightKg,
  lengthCm,
  widthCm,
  heightCm,
  insuranceEnabled,
  serviceConfig,
  minimumCharge,
}) {
  const volumetricDivisor = Math.max(1, toNumber(serviceConfig.volumetric_divisor, 4000));
  const actualWeightKg = Math.max(0, toNumber(weightKg, 0));
  const p = Math.max(0, toNumber(lengthCm, 0));
  const l = Math.max(0, toNumber(widthCm, 0));
  const t = Math.max(0, toNumber(heightCm, 0));
  const volumetricWeightKg = p > 0 && l > 0 && t > 0 ? (p * l * t) / volumetricDivisor : 0;
  const chargeableWeightKg = Math.max(actualWeightKg, volumetricWeightKg);

  if (chargeableWeightKg <= 0) {
    throw new Error('Berat aktual atau dimensi (P/L/T) harus diisi agar tarif bisa dihitung');
  }

  const baseFee = toNumber(serviceConfig.base_fee, 0);
  const distanceCharge = Math.max(0, toNumber(distanceKm, 0)) * toNumber(serviceConfig.rate_per_km, 0);
  const weightCharge = chargeableWeightKg * toNumber(serviceConfig.rate_per_kg, 0);
  const handlingFee = toNumber(serviceConfig.handling_fee, 0);

  const beforeInsurance = baseFee + distanceCharge + weightCharge + handlingFee;
  const insuranceFlat = insuranceEnabled ? toNumber(serviceConfig.insurance_fee_flat, 0) : 0;
  const insurancePercentAmount = insuranceEnabled
    ? (beforeInsurance * toNumber(serviceConfig.insurance_fee_percent, 0)) / 100
    : 0;
  const insuranceAmount = insuranceFlat + insurancePercentAmount;

  const subtotalBeforeFuel = beforeInsurance + insuranceAmount;
  const fuelSurcharge = (subtotalBeforeFuel * toNumber(serviceConfig.fuel_surcharge_percent, 0)) / 100;
  const subtotal = subtotalBeforeFuel + fuelSurcharge;

  const minCharge = Math.max(0, toNumber(minimumCharge, 0));
  const customerPrice = roundToInt(Math.max(subtotal, minCharge));

  let driverCommission;
  if (String(serviceConfig.driver_commission_type || 'fixed') === 'percentage') {
    driverCommission = roundToInt((customerPrice * toNumber(serviceConfig.driver_commission_value, 0)) / 100);
  } else {
    driverCommission = roundToInt(serviceConfig.driver_commission_value);
  }

  if (driverCommission > customerPrice) {
    driverCommission = customerPrice;
  }

  const platformMargin = roundToInt(customerPrice - driverCommission);

  return {
    customer_price: customerPrice,
    driver_commission: driverCommission,
    platform_margin: platformMargin,
    actual_weight_kg: actualWeightKg,
    volumetric_weight_kg: Number(volumetricWeightKg.toFixed(2)),
    chargeable_weight_kg: Number(chargeableWeightKg.toFixed(2)),
    volumetric_divisor: volumetricDivisor,
    breakdown: {
      base_fee: roundToInt(baseFee),
      distance_charge: roundToInt(distanceCharge),
      weight_charge: roundToInt(weightCharge),
      handling_fee: roundToInt(handlingFee),
      insurance_amount: roundToInt(insuranceAmount),
      fuel_surcharge: roundToInt(fuelSurcharge),
      subtotal_before_minimum: roundToInt(subtotal),
      minimum_charge_applied: roundToInt(minCharge),
    },
  };
}

router.get('/pricing/services', async (req, res) => {
  try {
    const db = req.db;
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    await ensureExpeditionTables(db);
    const [rows] = await db.query(
      `SELECT *
       FROM expedition_service_pricing
       ORDER BY service_type ASC, vehicle_type ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load service pricing', error: error.message });
  }
});

router.get('/pricing/minimum-charges', async (req, res) => {
  try {
    const db = req.db;
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    await ensureExpeditionTables(db);
    const [rows] = await db.query(
      `SELECT *
       FROM expedition_minimum_charge_rules
       ORDER BY service_type ASC, vehicle_type ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load minimum charges', error: error.message });
  }
});

router.post('/pricing/services/upsert', async (req, res) => {
  try {
    const db = req.db;
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    await ensureExpeditionTables(db);

    const {
      service_type,
      vehicle_type,
      transport_mode = 'land',
      sla_min_hours = null,
      sla_max_hours = null,
      volumetric_divisor = 4000,
      base_fee = 0,
      rate_per_km = 0,
      rate_per_kg = 0,
      insurance_fee_flat = 0,
      insurance_fee_percent = 0,
      fuel_surcharge_percent = 0,
      handling_fee = 0,
      driver_commission_type = 'fixed',
      driver_commission_value = 0,
      is_active = 1,
      notes = null,
    } = req.body || {};

    const normalizedVehicle = normalizeVehicleType(vehicle_type);
    const normalizedService = normalizeServiceType(service_type);
    if (!normalizedService || !normalizedVehicle) {
      return res.status(400).json({ success: false, message: 'service_type dan vehicle_type wajib valid' });
    }

    await db.query(
      `INSERT INTO expedition_service_pricing (
        service_type, vehicle_type, transport_mode,
        sla_min_hours, sla_max_hours,
        volumetric_divisor, base_fee, rate_per_km, rate_per_kg,
        insurance_fee_flat, insurance_fee_percent,
        fuel_surcharge_percent, handling_fee,
        driver_commission_type, driver_commission_value,
        is_active, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        transport_mode = VALUES(transport_mode),
        sla_min_hours = VALUES(sla_min_hours),
        sla_max_hours = VALUES(sla_max_hours),
        volumetric_divisor = VALUES(volumetric_divisor),
        base_fee = VALUES(base_fee),
        rate_per_km = VALUES(rate_per_km),
        rate_per_kg = VALUES(rate_per_kg),
        insurance_fee_flat = VALUES(insurance_fee_flat),
        insurance_fee_percent = VALUES(insurance_fee_percent),
        fuel_surcharge_percent = VALUES(fuel_surcharge_percent),
        handling_fee = VALUES(handling_fee),
        driver_commission_type = VALUES(driver_commission_type),
        driver_commission_value = VALUES(driver_commission_value),
        is_active = VALUES(is_active),
        notes = VALUES(notes)`,
      [
        normalizedService,
        normalizedVehicle,
        transport_mode === 'sea' ? 'sea' : 'land',
        sla_min_hours,
        sla_max_hours,
        Math.max(1, roundToInt(volumetric_divisor)),
        roundToInt(base_fee),
        roundToInt(rate_per_km),
        roundToInt(rate_per_kg),
        roundToInt(insurance_fee_flat),
        toNumber(insurance_fee_percent, 0),
        toNumber(fuel_surcharge_percent, 0),
        roundToInt(handling_fee),
        String(driver_commission_type) === 'percentage' ? 'percentage' : 'fixed',
        toNumber(driver_commission_value, 0),
        is_active ? 1 : 0,
        notes,
      ]
    );

    return res.json({ success: true, message: 'Service pricing tersimpan' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to upsert service pricing', error: error.message });
  }
});

router.post('/pricing/minimum-charges/upsert', async (req, res) => {
  try {
    const db = req.db;
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    await ensureExpeditionTables(db);

    const {
      service_type,
      vehicle_type = 'all',
      minimum_charge = 0,
      is_active = 1,
      notes = null,
    } = req.body || {};

    const normalizedService = normalizeServiceType(service_type || 'all');
    const normalizedVehicle = vehicle_type === 'all' ? 'all' : normalizeVehicleType(vehicle_type);
    if (!normalizedService || !normalizedVehicle) {
      return res.status(400).json({ success: false, message: 'service_type/vehicle_type tidak valid' });
    }

    await db.query(
      `INSERT INTO expedition_minimum_charge_rules (
        service_type, vehicle_type, minimum_charge, is_active, notes
      ) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        minimum_charge = VALUES(minimum_charge),
        is_active = VALUES(is_active),
        notes = VALUES(notes)`,
      [
        normalizedService,
        normalizedVehicle,
        roundToInt(minimum_charge),
        is_active ? 1 : 0,
        notes,
      ]
    );

    return res.json({ success: true, message: 'Minimum charge tersimpan' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to upsert minimum charge', error: error.message });
  }
});

/**
 * GET /api/expedition/office
 * Returns the current Hantar office / expedition origin point.
 */
router.get('/office', (req, res) => {
  return res.json({ success: true, data: HANTAR_OFFICE });
});

/**
 * GET /api/expedition/geocode?address=<text>
 * Proxy to Nominatim (OpenStreetMap) — returns lat, lon + address components
 */
router.get('/geocode', async (req, res) => {
  try {
    const rawAddress = String(req.query.address || '').trim().slice(0, 500);
    if (!rawAddress || rawAddress.length < 5) {
      return res.status(400).json({ success: false, message: 'address terlalu pendek' });
    }

    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: rawAddress + ', Indonesia',
        format: 'json',
        addressdetails: 1,
        limit: 1,
        countrycodes: 'id',
      },
      headers: {
        'User-Agent': 'Hantar-Expedition-Pilot/1.0 (admin@primaryline.id)',
        'Accept-Language': 'id,en',
      },
      timeout: 8000,
    });

    const places = response.data;
    if (!Array.isArray(places) || places.length === 0) {
      return res.json({ success: false, message: 'Alamat tidak ditemukan, coba lebih lengkap' });
    }

    const place = places[0];
    const addr = place.address || {};

    // Map Nominatim address fields to Indonesian postal hierarchy
    // In Indonesia: county = Kabupaten, city = Kota, municipality = Kecamatan
    const kabupaten = addr.county || addr.city || '';
    const kecamatan = addr.municipality || addr.city_district || addr.suburb || addr.town || addr.village || addr.hamlet || '';
    const provinsi = addr.state || '';
    const kodePos = addr.postcode || '';

    return res.json({
      success: true,
      data: {
        lat: parseFloat(place.lat),
        lon: parseFloat(place.lon),
        display_name: place.display_name,
        kabupaten,
        kecamatan,
        provinsi,
        kode_pos: kodePos,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Geocoding gagal', error: error.message });
  }
});

/**
 * GET /api/expedition/config
 */
router.get('/config', (req, res) => {
  return res.json({ success: true, data: PILOT_CONFIG });
});

/**
 * GET /api/expedition/quote?vehicle_type=&distance_km=
 */
router.get('/quote', async (req, res) => {
  try {
    const db = req.db;
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    await ensureExpeditionTables(db);

    const {
      vehicle_type,
      service_type = 'regular',
      distance_km,
      weight_kg,
      length_cm,
      width_cm,
      height_cm,
      insurance_enabled = 'false',
    } = req.query;

    const normalized = normalizeVehicleType(vehicle_type);
    const normalizedService = normalizeServiceType(service_type);
    const distanceKm = parseFloat(distance_km || '0');

    if (!normalized) {
      return res.status(400).json({ success: false, message: 'vehicle_type harus sepeda/bicycle atau motor/motorcycle' });
    }

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      return res.status(400).json({ success: false, message: 'distance_km harus angka > 0' });
    }

    if (normalized === 'bicycle' && distanceKm > PILOT_CONFIG.bicycle_max_distance_km) {
      return res.status(400).json({
        success: false,
        message: `Untuk sepeda, jarak maksimal ${PILOT_CONFIG.bicycle_max_distance_km} km`,
      });
    }

    const serviceConfig = await getServicePricing(db, normalizedService, normalized);
    const minimumCharge = await getMinimumCharge(db, normalizedService, normalized);
    const pricing = calculatePriceByFormula({
      distanceKm,
      weightKg: weight_kg,
      lengthCm: length_cm,
      widthCm: width_cm,
      heightCm: height_cm,
      insuranceEnabled: String(insurance_enabled).toLowerCase() === 'true',
      serviceConfig,
      minimumCharge,
    });

    return res.json({
      success: true,
      data: {
        area: PILOT_CONFIG.area,
        service_type: normalizedService,
        vehicle_type: normalized,
        distance_km: distanceKm,
        customer_price: pricing.customer_price,
        driver_commission: pricing.driver_commission,
        platform_margin: pricing.platform_margin,
        actual_weight_kg: pricing.actual_weight_kg,
        volumetric_weight_kg: pricing.volumetric_weight_kg,
        chargeable_weight_kg: pricing.chargeable_weight_kg,
        volumetric_divisor: pricing.volumetric_divisor,
        minimum_charge: minimumCharge,
        breakdown: pricing.breakdown,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to calculate quote', error: error.message });
  }
});

/**
 * GET /api/expedition/shipments
 */
router.get('/shipments', async (req, res) => {
  try {
    const db = req.db;
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    await ensureExpeditionTables(db);

    const status = (req.query.status || 'all').toLowerCase();
    const search = (req.query.search || '').trim();
    const vehicleType = normalizeVehicleType(req.query.vehicle_type || '') || 'all';

    const where = [];
    const params = [];

    if (status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }

    if (vehicleType !== 'all') {
      where.push('vehicle_type = ?');
      params.push(vehicleType);
    }

    if (search) {
      where.push('(tracking_number LIKE ? OR sender_name LIKE ? OR recipient_name LIKE ? OR sender_phone LIKE ? OR recipient_phone LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT id, tracking_number, service_type, vehicle_type, sender_name, sender_phone,
              recipient_name, recipient_phone, distance_km, customer_price, driver_commission,
              platform_margin, pickup_type, insurance_enabled, status, created_at
       FROM expedition_shipments
       ${whereClause}
       ORDER BY id DESC
       LIMIT 300`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load expedition shipments', error: error.message });
  }
});

/**
 * POST /api/expedition/shipments
 */
router.post('/shipments', async (req, res) => {
  try {
    const db = req.db;
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    await ensureExpeditionTables(db);

    const {
      service_type = 'regular',
      vehicle_type,
      sender_name,
      sender_phone,
      sender_address,
      sender_kecamatan,
      sender_kelurahan,
      sender_kabupaten,
      sender_provinsi,
      sender_postal_code,
      recipient_name,
      recipient_phone,
      recipient_address,
      recipient_kecamatan,
      recipient_kelurahan,
      recipient_kabupaten,
      recipient_provinsi,
      recipient_postal_code,
      distance_km,
      weight_kg,
      length_cm,
      width_cm,
      height_cm,
      insurance_enabled = false,
      pickup_type = 'pickup',
      notes,
      created_by,
    } = req.body;

    const normalizedVehicle = normalizeVehicleType(vehicle_type);
    const normalizedService = normalizeServiceType(service_type);
    const distanceKm = parseFloat(distance_km || '0');

    if (!normalizedVehicle) {
      return res.status(400).json({ success: false, message: 'vehicle_type wajib sepeda/bicycle atau motor/motorcycle' });
    }

    if (!sender_name || !sender_phone || !sender_address || !recipient_name || !recipient_phone || !recipient_address) {
      return res.status(400).json({
        success: false,
        message: 'Data pengirim dan penerima wajib lengkap',
      });
    }

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      return res.status(400).json({ success: false, message: 'distance_km harus angka > 0' });
    }

    if (normalizedVehicle === 'bicycle' && distanceKm > PILOT_CONFIG.bicycle_max_distance_km) {
      return res.status(400).json({
        success: false,
        message: `Untuk sepeda, jarak maksimal ${PILOT_CONFIG.bicycle_max_distance_km} km`,
      });
    }

    const serviceConfig = await getServicePricing(db, normalizedService, normalizedVehicle);
    const minimumCharge = await getMinimumCharge(db, normalizedService, normalizedVehicle);
    const pricing = calculatePriceByFormula({
      distanceKm,
      weightKg: weight_kg,
      lengthCm: length_cm,
      widthCm: width_cm,
      heightCm: height_cm,
      insuranceEnabled: Boolean(insurance_enabled),
      serviceConfig,
      minimumCharge,
    });

    const customerPrice = pricing.customer_price;
    const driverCommission = pricing.driver_commission;
    const platformMargin = pricing.platform_margin;
    const trackingNumber = buildTrackingNumber();

    const [result] = await db.query(
      `INSERT INTO expedition_shipments (
        tracking_number, area, service_type, vehicle_type,
        sender_name, sender_phone, sender_address, sender_kecamatan, sender_kelurahan, sender_kabupaten, sender_provinsi, sender_postal_code,
        recipient_name, recipient_phone, recipient_address, recipient_kecamatan, recipient_kelurahan, recipient_kabupaten, recipient_provinsi, recipient_postal_code,
        distance_km, weight_kg, volumetric_weight_kg, chargeable_weight_kg, length_cm, width_cm, height_cm,
        insurance_enabled, pickup_type, customer_price, driver_commission, platform_margin,
        pricing_breakdown_json, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        trackingNumber,
        PILOT_CONFIG.area,
        normalizedService,
        normalizedVehicle,
        sender_name,
        sender_phone,
        sender_address,
        sender_kecamatan || null,
        sender_kelurahan || null,
        sender_kabupaten || null,
        sender_provinsi || null,
        sender_postal_code || null,
        recipient_name,
        recipient_phone,
        recipient_address,
        recipient_kecamatan || null,
        recipient_kelurahan || null,
        recipient_kabupaten || null,
        recipient_provinsi || null,
        recipient_postal_code || null,
        distanceKm,
        weight_kg || null,
        pricing.volumetric_weight_kg || null,
        pricing.chargeable_weight_kg || null,
        length_cm || null,
        width_cm || null,
        height_cm || null,
        insurance_enabled ? 1 : 0,
        pickup_type === 'drop_point' ? 'drop_point' : 'pickup',
        customerPrice,
        driverCommission,
        platformMargin,
        JSON.stringify(pricing.breakdown),
        'created',
        notes || null,
        created_by || 'admin-web',
      ]
    );

    await db.query(
      `INSERT INTO expedition_shipment_events (shipment_id, event_code, event_label, event_notes)
       VALUES (?, 'ORDER_CREATED', 'Order dibuat admin', ?)`,
      [result.insertId, notes || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Shipment berhasil dibuat',
      data: {
        id: result.insertId,
        tracking_number: trackingNumber,
        customer_price: customerPrice,
        driver_commission: driverCommission,
        platform_margin: platformMargin,
        distance_km: distanceKm,
        service_type: normalizedService,
        vehicle_type: normalizedVehicle,
        actual_weight_kg: pricing.actual_weight_kg,
        volumetric_weight_kg: pricing.volumetric_weight_kg,
        chargeable_weight_kg: pricing.chargeable_weight_kg,
        minimum_charge: minimumCharge,
        breakdown: pricing.breakdown,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create expedition shipment', error: error.message });
  }
});

/**
 * PATCH /api/expedition/shipments/:id/status
 */
router.patch('/shipments/:id/status', async (req, res) => {
  try {
    const db = req.db;
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    await ensureExpeditionTables(db);

    const id = parseInt(req.params.id, 10);
    const { status, event_notes } = req.body;

    const allowed = ['created', 'scheduled', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned'];
    if (!allowed.includes(String(status || '').toLowerCase())) {
      return res.status(400).json({ success: false, message: 'status tidak valid' });
    }

    const normalizedStatus = String(status).toLowerCase();

    const [rows] = await db.query('SELECT id FROM expedition_shipments WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Shipment tidak ditemukan' });
    }

    await db.query('UPDATE expedition_shipments SET status = ? WHERE id = ?', [normalizedStatus, id]);

    const labelMap = {
      created: 'Order dibuat',
      scheduled: 'Pickup dijadwalkan',
      picked_up: 'Paket di-pickup',
      in_transit: 'Paket dalam perjalanan',
      delivered: 'Paket berhasil diterima',
      failed: 'Pengiriman gagal',
      returned: 'Paket dikembalikan',
    };

    await db.query(
      `INSERT INTO expedition_shipment_events (shipment_id, event_code, event_label, event_notes)
       VALUES (?, ?, ?, ?)`,
      [id, normalizedStatus.toUpperCase(), labelMap[normalizedStatus] || normalizedStatus, event_notes || null]
    );

    return res.json({ success: true, message: 'Status shipment diperbarui' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update shipment status', error: error.message });
  }
});

/**
 * GET /api/expedition/shipments/:id/events
 */
router.get('/shipments/:id/events', async (req, res) => {
  try {
    const db = req.db;
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    await ensureExpeditionTables(db);

    const id = parseInt(req.params.id, 10);
    const [rows] = await db.query(
      `SELECT id, event_code, event_label, event_notes, created_at
       FROM expedition_shipment_events
       WHERE shipment_id = ?
       ORDER BY id ASC`,
      [id]
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load shipment events', error: error.message });
  }
});

module.exports = router;
