const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcrypt');

/**
 * POST /api/test/create-test-driver
 * Create test driver for withdrawal testing
 * 
 * ONLY USE IN DEVELOPMENT/SANDBOX!
 */
router.post('/create-test-driver', async (req, res) => {
  try {
    // First, create user account
    const timestamp = Date.now();
    const email = `driver.test.${timestamp}@example.com`;
    const username = `testdriver${timestamp}`;
    const phone = `08${timestamp.toString().slice(-9)}`; // Generate unique phone number
    
    const [userResult] = await db.query(
      `INSERT INTO users (username, email, phone, password, user_type, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, phone, 'dummy_password_hash', 'driver', 1]
    );

    const userId = userResult.insertId;

    // Update user password to valid hash
    const hashedPassword = await bcrypt.hash('TestDriver123!', 10);
    await db.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    // Then create independent driver with correct schema
    const [result] = await db.query(
      `INSERT INTO independent_drivers (
        user_id, full_name, phone, email,
        vehicle_type, vehicle_plate, license_number,
        bank_name, bank_account_number, bank_account_holder,
        total_earnings, status, is_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'Budi Santoso Test',
        phone,
        email,
        'motorcycle',  // Must match enum: bike, motorcycle, car, truck
        `B${userId}TEST`,
        `LIC${userId}TEST`,
        'BCA',
        '1234567890',
        'Budi Santoso',
        500000, // Total earnings Rp 500k
        'active',  // Must match enum: pending, active, inactive, offline
        1  // true = verified
      ]
    );

    const driverId = result.insertId;

    // Get created driver
    const [driver] = await db.query(
      'SELECT id, email, full_name, bank_name, bank_account_number, total_earnings FROM independent_drivers WHERE id = ?',
      [driverId]
    );

    console.log('✅ Test driver created:', driverId);

    return res.json({
      success: true,
      message: 'Test driver created successfully',
      data: {
        driver_id: driverId,
        phone: phone,
        password: 'TestDriver123!',
        email: driver[0].email,
        full_name: driver[0].full_name,
        bank_name: driver[0].bank_name,
        bank_account_number: driver[0].bank_account_number,
        total_earnings: driver[0].total_earnings,
        login_url: `https://travel-api-production-23ae.up.railway.app/api/driver-auth/login (POST with phone and password)`
      }
    });

  } catch (error) {
    console.error('❌ Error creating test driver:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create test driver',
      error: error.message
    });
  }
});

/**
 * DELETE /api/test/cleanup-test-drivers
 * Delete all test drivers (email contains 'driver.test')
 */
router.delete('/cleanup-test-drivers', async (req, res) => {
  try {
    // Delete test drivers
    const [result] = await db.query(
      "DELETE FROM independent_drivers WHERE email LIKE 'driver.test%'"
    );

    console.log(`✅ Deleted ${result.affectedRows} test drivers`);

    return res.json({
      success: true,
      message: `Deleted ${result.affectedRows} test driver(s)`
    });

  } catch (error) {
    console.error('❌ Error cleanup test drivers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cleanup',
      error: error.message
    });
  }
});

/**
 * PATCH /api/test/update-driver-bank/:driver_id
 * Update driver bank information
 */
router.patch('/update-driver-bank/:driver_id', async (req, res) => {
  try {
    const { driver_id } = req.params;
    const { bank_name, bank_account_number, bank_account_holder } = req.body;

    if (!bank_name || !bank_account_number || !bank_account_holder) {
      return res.status(400).json({
        success: false,
        message: 'bank_name, bank_account_number, and bank_account_holder are required'
      });
    }

    const db_instance = req.db;

    const [result] = await db_instance.query(
      `UPDATE independent_drivers 
       SET bank_name = ?, bank_account_number = ?, bank_account_holder = ?
       WHERE id = ?`,
      [bank_name, bank_account_number, bank_account_holder, driver_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const [driver] = await db_instance.query(
      'SELECT id, bank_name, bank_account_number, bank_account_holder FROM independent_drivers WHERE id = ?',
      [driver_id]
    );

    return res.json({
      success: true,
      message: 'Driver bank info updated',
      data: driver[0]
    });

  } catch (error) {
    console.error('❌ Error updating driver bank info:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update driver bank info',
      error: error.message
    });
  }
});

module.exports = router;
