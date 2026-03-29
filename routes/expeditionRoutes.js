const express = require('express');
const router = express.Router();
const axios = require('axios');

const PILOT_CONFIG = {
  area: 'Kabupaten Tangerang',
  bicycle_max_distance_km: 5,
  rates: {
    bicycle: {
      customer_price: 10000,
      driver_commission: 4000,
    },
    motorcycle: {
      customer_price: 20000,
      driver_commission: 8000,
    },
  },
};

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
      length_cm DECIMAL(8,2) NULL,
      width_cm DECIMAL(8,2) NULL,
      height_cm DECIMAL(8,2) NULL,

      insurance_enabled TINYINT(1) NOT NULL DEFAULT 0,
      pickup_type ENUM('pickup','drop_point') NOT NULL DEFAULT 'pickup',

      customer_price INT NOT NULL,
      driver_commission INT NOT NULL,
      platform_margin INT NOT NULL,

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
  ];
  for (const sql of migrationCols) {
    await db.query(sql).catch(() => {});
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
    const { vehicle_type, distance_km } = req.query;
    const normalized = normalizeVehicleType(vehicle_type);
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

    const rate = PILOT_CONFIG.rates[normalized];
    const platformMargin = rate.customer_price - rate.driver_commission;

    return res.json({
      success: true,
      data: {
        area: PILOT_CONFIG.area,
        vehicle_type: normalized,
        distance_km: distanceKm,
        customer_price: rate.customer_price,
        driver_commission: rate.driver_commission,
        platform_margin: platformMargin,
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

    const rate = PILOT_CONFIG.rates[normalizedVehicle];
    const customerPrice = rate.customer_price;
    const driverCommission = rate.driver_commission;
    const platformMargin = customerPrice - driverCommission;
    const trackingNumber = buildTrackingNumber();

    const [result] = await db.query(
      `INSERT INTO expedition_shipments (
        tracking_number, area, service_type, vehicle_type,
        sender_name, sender_phone, sender_address, sender_kecamatan, sender_kelurahan, sender_kabupaten, sender_provinsi, sender_postal_code,
        recipient_name, recipient_phone, recipient_address, recipient_kecamatan, recipient_kelurahan, recipient_kabupaten, recipient_provinsi, recipient_postal_code,
        distance_km, weight_kg, length_cm, width_cm, height_cm,
        insurance_enabled, pickup_type, customer_price, driver_commission, platform_margin,
        status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', ?, ?)` ,
      [
        trackingNumber,
        PILOT_CONFIG.area,
        String(service_type || 'regular').toLowerCase(),
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
        length_cm || null,
        width_cm || null,
        height_cm || null,
        insurance_enabled ? 1 : 0,
        pickup_type === 'drop_point' ? 'drop_point' : 'pickup',
        customerPrice,
        driverCommission,
        platformMargin,
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
        vehicle_type: normalizedVehicle,
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
