const express = require('express');
const router = express.Router();
const db = require('../config/database');

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
    
    const [userResult] = await db.query(
      `INSERT INTO users (email, role) VALUES (?, 'driver')`,
      [email]
    );

    const userId = userResult.insertId;

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
        '081234567890',
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
        email: driver[0].email,
        full_name: driver[0].full_name,
        bank_name: driver[0].bank_name,
        bank_account_number: driver[0].bank_account_number,
        total_earnings: driver[0].total_earnings,
        test_command: `./test_withdrawal_with_driver_id.sh ${driverId}`
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

module.exports = router;
