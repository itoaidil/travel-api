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

module.exports = router;
