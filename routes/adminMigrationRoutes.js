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

module.exports = router;
