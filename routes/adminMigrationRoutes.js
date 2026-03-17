const express = require('express');
const router = express.Router();
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * GET /api/admin/migrate
 * Run database migrations
 */
router.get('/migrate', async (req, res) => {
  try {
    console.log('🔄 Running driver_notifications migration...');
    
    // Create driver_notifications table
    await db.query(`
      CREATE TABLE IF NOT EXISTS driver_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        driver_id INT NOT NULL,
        booking_id INT NULL,
        notification_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSON NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP NULL,
        
        INDEX idx_driver_id (driver_id),
        INDEX idx_booking_id (booking_id),
        INDEX idx_is_read (is_read),
        INDEX idx_created_at (created_at),
        
        FOREIGN KEY (driver_id) REFERENCES independent_drivers(id) ON DELETE CASCADE,
        FOREIGN KEY (booking_id) REFERENCES independent_bookings(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ driver_notifications table created');
    
    // Create composite index
    try {
      await db.query(`
        CREATE INDEX idx_driver_unread ON driver_notifications (driver_id, is_read, created_at)
      `);
      console.log('✅ Composite index created');
    } catch (indexError) {
      if (indexError.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️ Index already exists, skipping');
      } else {
        console.warn('⚠️ Index creation warning:', indexError.message);
      }
    }
    
    return res.json({
      success: true,
      message: 'Migrations completed successfully',
      tables_created: ['driver_notifications']
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/migrate/customer-fcm
 * Add fcm_token column to customers table
 */
router.post('/migrate/customer-fcm', async (req, res) => {
  try {
    console.log('🔄 Adding fcm_token column to customers table...');
    
    // Check if column exists
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME = 'fcm_token'
    `);
    
    if (columns.length > 0) {
      console.log('⚠️ fcm_token column already exists');
      return res.json({
        success: true,
        message: 'fcm_token column already exists',
        already_exists: true
      });
    }
    
    // Add fcm_token column
    await db.query(`
      ALTER TABLE customers 
      ADD COLUMN fcm_token VARCHAR(255) DEFAULT NULL
    `);
    console.log('✅ fcm_token column added');
    
    // Add index
    try {
      await db.query(`
        ALTER TABLE customers 
        ADD INDEX idx_customers_fcm_token (fcm_token)
      `);
      console.log('✅ Index on fcm_token created');
    } catch (indexError) {
      if (indexError.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️ Index already exists');
      } else {
        console.warn('⚠️ Index creation warning:', indexError.message);
      }
    }
    
    return res.json({
      success: true,
      message: 'fcm_token column added to customers table successfully'
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/migrate-013
 * Create batch_deliveries table for corporate bulk letter/document delivery.
 */
router.post('/migrate-013', async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS batch_deliveries (
        id            BIGINT AUTO_INCREMENT PRIMARY KEY,
        row_no        VARCHAR(20)   NULL,
        npp           VARCHAR(50)   NOT NULL,
        recipient_address TEXT      NOT NULL,
        lat           DECIMAL(10,8) NOT NULL DEFAULT 0,
        lng           DECIMAL(11,8) NOT NULL DEFAULT 0,
        wave          INT           NULL,
        driver_id     INT           NULL,
        status        ENUM(
                        'pending','assigned','in_progress',
                        'delivered','not_found','address_mismatch','refused','returned'
                      ) NOT NULL DEFAULT 'pending',
        delivery_photo_url VARCHAR(512) NULL,
        driver_notes  TEXT          NULL,
        assigned_at   TIMESTAMP     NULL,
        delivered_at  TIMESTAMP     NULL,
        created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_npp (npp),
        INDEX idx_status   (status),
        INDEX idx_driver   (driver_id),
        INDEX idx_wave     (wave),
        FOREIGN KEY fk_bd_driver (driver_id)
          REFERENCES independent_drivers(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ batch_deliveries table created');
    return res.json({ success: true, message: 'batch_deliveries table created successfully' });
  } catch (error) {
    console.error('❌ Migration 013 error:', error);
    return res.status(500).json({ success: false, message: 'Migration failed', error: error.message });
  }
});

/**
 * POST /api/admin/migrate-014
 * Add penerima column to batch_deliveries table (after updated_at).
 */
router.post('/migrate-014', async (req, res) => {
  try {
    // Check if column already exists
    const [cols] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'batch_deliveries'
        AND COLUMN_NAME = 'penerima'
    `);
    if (cols.length > 0) {
      return res.json({ success: true, message: 'Kolom penerima sudah ada', already_exists: true });
    }
    await db.query(`
      ALTER TABLE batch_deliveries
      ADD COLUMN penerima VARCHAR(255) NULL AFTER updated_at
    `);
    console.log('✅ batch_deliveries.penerima column added');
    return res.json({ success: true, message: 'Kolom penerima berhasil ditambahkan' });
  } catch (error) {
    console.error('❌ Migration 014 error:', error);
    return res.status(500).json({ success: false, message: 'Migration failed', error: error.message });
  }
});

/**
 * POST /api/admin/migrate-015
 * Add batch_code generated column to batch_deliveries (BATCH-0001 format).
 */
router.post('/migrate-015', async (req, res) => {
  try {
    const [cols] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'batch_deliveries'
        AND COLUMN_NAME = 'batch_code'
    `);
    if (cols.length > 0) {
      return res.json({ success: true, message: 'Kolom batch_code sudah ada', already_exists: true });
    }
    await db.query(`
      ALTER TABLE batch_deliveries
      ADD COLUMN batch_code VARCHAR(20) NULL AFTER penerima
    `);
    // Populate all existing rows
    await db.query(`
      UPDATE batch_deliveries
      SET batch_code = CONCAT('BATCH-', LPAD(id, 4, '0'))
      WHERE batch_code IS NULL
    `);
    console.log('✅ batch_deliveries.batch_code column added and populated');
    return res.json({ success: true, message: 'Kolom batch_code berhasil ditambahkan dan diisi' });
  } catch (error) {
    console.error('❌ Migration 015 error:', error);
    return res.status(500).json({ success: false, message: 'Migration failed', error: error.message });
  }
});

/**
 * POST /api/admin/migrate-016
 * Add customer_id column to batch_deliveries and set existing rows to customer_id=29.
 */
router.post('/migrate-016', async (req, res) => {
  try {
    const [cols] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'batch_deliveries'
        AND COLUMN_NAME = 'customer_id'
    `);
    if (cols.length === 0) {
      await db.query(`
        ALTER TABLE batch_deliveries
        ADD COLUMN customer_id INT NULL AFTER batch_code,
        ADD INDEX idx_customer (customer_id)
      `);
      console.log('✅ batch_deliveries.customer_id column added');
    }
    // Assign all existing rows to customer_id=29
    const [result] = await db.query(
      `UPDATE batch_deliveries SET customer_id = 29 WHERE customer_id IS NULL`
    );
    console.log(`✅ Updated ${result.affectedRows} rows with customer_id=29`);
    return res.json({
      success: true,
      message: 'Kolom customer_id ditambahkan dan semua baris di-assign ke customer_id=29',
      rows_updated: result.affectedRows
    });
  } catch (error) {
    console.error('❌ Migration 016 error:', error);
    return res.status(500).json({ success: false, message: 'Migration failed', error: error.message });
  }
});

/**
 * POST /api/admin/migrate-017
 * Add kawasan column to batch_deliveries and auto-detect from recipient_address.
 * Kawasan rules ordered from most specific to most general.
 */
router.post('/migrate-017', async (req, res) => {
  try {
    // 1. Add column if not exists
    const [cols] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'batch_deliveries'
        AND COLUMN_NAME = 'kawasan'
    `);
    if (cols.length === 0) {
      await db.query(`
        ALTER TABLE batch_deliveries
        ADD COLUMN kawasan VARCHAR(100) NULL AFTER customer_id,
        ADD INDEX idx_kawasan (kawasan)
      `);
      console.log('✅ batch_deliveries.kawasan column added');
    }

    // 2. Kawasan detection rules: [label, keywords[]]
    //    Ordered most-specific first
    const KAWASAN_RULES = [
      ['Kaw. Ind. Millenium',   ['MILLENIUM', 'MILLENNIUM']],
      ['Kaw. Ind. Cikupa Mas',  ['CIKUPA MAS']],
      ['Kaw. Ind. Balaraja',    ['BALARAJA PERMAI', 'INDO PERMAI BALARAJA', 'JATAKE']],
      ['BSD City',              ['BSD', 'GADING SERPONG', 'YCHUB', 'ITC BSD']],
      ['Citra Raya',            ['CITRA RAYA', 'CITA RAYA', 'RAYA ECOPOLIS']],
      ['Suvarna Sutera',        ['SUVARNA SUTERA', 'SUVARNA']],
      ['Talaga Bestari',        ['TALAGA BESTARI']],
      ['Lippo Karawaci',        ['LIPPO KARAWACI', 'LIPPO']],
      ['Grand Wisata',          ['GRAND WISATA']],
      ['Palem Semi',            ['PALEM SEMI']],
      ['Serpong',               ['SERPONG']],
      ['Kelapa Dua',            ['KELAPA DUA']],
      ['Pagedangan',            ['PAGEDANGAN']],
      ['Cisauk',                ['CISAUK']],
      ['Cikupa',                ['CIKUPA']],
      ['Panongan',              ['PANONGAN']],
      ['Curug',                 ['CURUG']],
      ['Tigaraksa',             ['TIGARAKSA']],
      ['Balaraja',              ['BALARAJA', 'SENTUL JAYA']],
      ['Kosambi',               ['KOSAMBI']],
      ['Pasar Kemis',           ['PASAR KEMIS']],
      ['Legok',                 ['LEGOK']],
      ['Teluknaga',             ['TELUKNAGA']],
      ['Jayanti',               ['JAYANTI']],
      ['Solear',                ['SOLEAR']],
      ['Pakuhaji',              ['PAKUHAJI']],
      ['Sepatan',               ['SEPATAN']],
      ['Jambe',                 ['JAMBE']],
      ['Rajeg',                 ['RAJEG']],
      ['Cibodas',               ['CIBODAS']],
    ];

    // 3. Fetch all rows that need kawasan set
    const [rows] = await db.query(
      `SELECT id, recipient_address FROM batch_deliveries WHERE kawasan IS NULL`
    );

    let updated = 0;
    let notMatched = 0;
    for (const row of rows) {
      const addr = (row.recipient_address || '').toUpperCase().replace(/\n/g, ' ');
      let matched = null;
      for (const [label, keywords] of KAWASAN_RULES) {
        if (keywords.some(kw => addr.includes(kw))) {
          matched = label;
          break;
        }
      }
      if (matched) {
        await db.query(`UPDATE batch_deliveries SET kawasan = ? WHERE id = ?`, [matched, row.id]);
        updated++;
      } else {
        await db.query(`UPDATE batch_deliveries SET kawasan = 'Lainnya' WHERE id = ?`, [row.id]);
        notMatched++;
      }
    }

    console.log(`✅ Migration 017: ${updated} rows matched, ${notMatched} rows set to Lainnya`);
    return res.json({
      success: true,
      message: 'Kolom kawasan ditambahkan dan diisi berdasarkan alamat',
      matched: updated,
      lainnya: notMatched,
      total: rows.length
    });
  } catch (error) {
    console.error('❌ Migration 017 error:', error);
    return res.status(500).json({ success: false, message: 'Migration failed', error: error.message });
  }
});

/**
 * POST /api/admin/migrate-018
 * Add vehicle_photo_url column to independent_drivers after last_fcm_update
 */
router.post('/migrate-018', async (req, res) => {
  try {
    const [cols] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'independent_drivers'
        AND COLUMN_NAME = 'vehicle_photo_url'
    `);
    if (cols.length > 0) {
      return res.json({ success: true, message: 'Kolom vehicle_photo_url sudah ada, tidak perlu migrasi' });
    }
    await db.query(`
      ALTER TABLE independent_drivers
      ADD COLUMN vehicle_photo_url VARCHAR(500) NULL AFTER last_fcm_update
    `);
    console.log('✅ vehicle_photo_url column added to independent_drivers');
    return res.json({ success: true, message: 'Kolom vehicle_photo_url berhasil ditambahkan' });
  } catch (error) {
    console.error('❌ Migration 018 error:', error);
    return res.status(500).json({ success: false, message: 'Migration failed', error: error.message });
  }
});

/**
 * GET /api/admin/migrate-019
 * Add nama_kecamatan and nama_kabupaten columns to batch_deliveries
 */
router.get('/migrate-019', async (req, res) => {
  try {
    const results = [];

    // Check and add nama_kecamatan
    const [colKecamatan] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'batch_deliveries'
        AND COLUMN_NAME = 'nama_kecamatan'
    `);
    if (colKecamatan.length > 0) {
      results.push('nama_kecamatan sudah ada, dilewati');
    } else {
      await db.query(`
        ALTER TABLE batch_deliveries
        ADD COLUMN nama_kecamatan VARCHAR(100) NULL AFTER kawasan
      `);
      console.log('✅ nama_kecamatan added to batch_deliveries');
      results.push('nama_kecamatan berhasil ditambahkan');
    }

    // Check and add nama_kabupaten
    const [colKabupaten] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'batch_deliveries'
        AND COLUMN_NAME = 'nama_kabupaten'
    `);
    if (colKabupaten.length > 0) {
      results.push('nama_kabupaten sudah ada, dilewati');
    } else {
      await db.query(`
        ALTER TABLE batch_deliveries
        ADD COLUMN nama_kabupaten VARCHAR(100) NULL AFTER nama_kecamatan
      `);
      console.log('✅ nama_kabupaten added to batch_deliveries');
      results.push('nama_kabupaten berhasil ditambahkan');
    }

    return res.json({ success: true, message: results.join('; ') });
  } catch (error) {
    console.error('❌ Migration 019 error:', error);
    return res.status(500).json({ success: false, message: 'Migration failed', error: error.message });
  }
});

/**
 * GET /api/admin/reset-delivery?npp=22214381
 * Reset batch_deliveries record back to pending for testing purposes
 */
router.get('/reset-delivery', async (req, res) => {
  try {
    const { npp } = req.query;
    if (!npp) return res.status(400).json({ success: false, message: 'Parameter npp diperlukan' });

    // Check current data first
    const [rows] = await db.query(
      `SELECT id, npp, status, driver_id, assigned_at, delivered_at FROM batch_deliveries WHERE npp = ?`,
      [npp]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: `Data dengan npp '${npp}' tidak ditemukan` });
    }

    // Reset to initial pending state
    const [result] = await db.query(
      `UPDATE batch_deliveries
       SET status = 'pending',
           driver_id = NULL,
           assigned_at = NULL,
           delivered_at = NULL,
           delivery_photo_url = NULL,
           driver_notes = NULL,
           updated_at = NOW()
       WHERE npp = ?`,
      [npp]
    );

    console.log(`✅ Reset npp=${npp}: ${result.affectedRows} row(s) affected`);
    return res.json({
      success: true,
      message: `${result.affectedRows} data dengan npp '${npp}' berhasil direset ke pending`,
      before: rows,
    });
  } catch (error) {
    console.error('❌ Reset delivery error:', error);
    return res.status(500).json({ success: false, message: 'Reset failed', error: error.message });
  }
});

module.exports = router;

