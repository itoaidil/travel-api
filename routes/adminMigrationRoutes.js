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

module.exports = router;
