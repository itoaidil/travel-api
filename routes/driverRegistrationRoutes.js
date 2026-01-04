const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

/**
 * POST /api/driver/register
 * Register new driver account
 * Body: {
 *   phone: string (unique),
 *   fullName: string,
 *   password: string,
 *   vehicle_type: string (motorcycle|car|truck),
 *   license_plate: string,
 *   vehicle_year: number
 * }
 */
router.post('/register', async (req, res) => {
  try {
    const { phone, fullName, password, vehicle_type, license_plate, vehicle_year } = req.body;

    // Validate required fields
    if (!phone || !fullName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone, full name, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const db = req.db;

    // Check if driver with this phone already exists
    const [existing] = await db.query(
      'SELECT id FROM independent_drivers WHERE phone = ?',
      [phone]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create driver account
    const [result] = await db.query(
      `INSERT INTO independent_drivers (
        phone, full_name, password, vehicle_type, license_plate, vehicle_year, 
        is_active, status, is_online, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        phone,
        fullName,
        hashedPassword,
        vehicle_type || 'motorcycle',
        license_plate || null,
        vehicle_year || null,
        0, // not active until admin approval
        'pending_approval',
        0  // offline
      ]
    );

    const driverId = result.insertId;

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Admin will review your request within 24 hours.',
      driver_id: driverId,
      status: 'pending_approval'
    });

  } catch (error) {
    console.error('Error during driver registration:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

/**
 * POST /api/driver/login
 * Login driver with phone and password
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone and password are required'
      });
    }

    const db = req.db;

    // Find driver by phone
    const [drivers] = await db.query(
      `SELECT id, phone, full_name, password, is_active, status, rating, total_trips 
       FROM independent_drivers WHERE phone = ?`,
      [phone]
    );

    if (drivers.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone or password'
      });
    }

    const driver = drivers[0];

    // Check if account is active (approved by admin)
    if (!driver.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not yet approved. Please wait for admin verification.',
        status: driver.status
      });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, driver.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone or password'
      });
    }

    // Return driver info
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        userId: driver.id,
        phone: driver.phone,
        fullName: driver.full_name,
        rating: driver.rating || 0,
        totalTrips: driver.total_trips || 0
      }
    });

  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
});

module.exports = router;
