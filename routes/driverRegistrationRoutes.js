const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { uploadDriverPhoto } = require('../config/cloudinary');

/**
 * POST /api/driver-auth/upload-photo
 * Upload single driver photo to Cloudinary
 * Form-data: photo (file)
 */
router.post('/upload-photo', uploadDriverPhoto.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Photo uploaded successfully',
      data: {
        url: req.file.path,
        filename: req.file.filename
      }
    });

  } catch (error) {
    console.error('Error uploading photo:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload photo',
      error: error.message
    });
  }
});

/**
 * POST /api/driver-auth/register
 * Register new driver account with complete data
 * Body: {
 *   phone, fullName, nik, birthPlace, birthDate, address, rt, rw, 
 *   kelurahan, kecamatan, agama, maritalStatus, email,
 *   vehicleType, vehicleColor, vehicleYear,
 *   bankName, accountNumber, accountName,
 *   ktpPhotoUrl, selfiePhotoUrl, password
 * }
 */
router.post('/register', async (req, res) => {
  try {
    const {
      phone, fullName, nik, birthPlace, birthDate, address, 
      rt, rw, kelurahan, kecamatan, agama, maritalStatus, email,
      vehicleType, vehicleColor, vehicleYear,
      bankName, accountNumber, accountName,
      ktpPhotoUrl, selfiePhotoUrl, password
    } = req.body;

    // Validate required fields
    if (!phone || !fullName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone, full name, and password are required'
      });
    }

    if (!nik || !ktpPhotoUrl || !selfiePhotoUrl) {
      return res.status(400).json({
        success: false,
        message: 'NIK, KTP photo, and selfie photo are required'
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
      'SELECT id FROM independent_drivers WHERE phone = ? OR nik = ?',
      [phone, nik]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Phone number or NIK already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create driver account
    const [result] = await db.query(
      `INSERT INTO independent_drivers (
        phone, full_name, nik, birth_place, birth_date, address, rt, rw,
        kelurahan, kecamatan, agama, marital_status, email,
        vehicle_type, vehicle_color, vehicle_year,
        bank_name, account_number, account_name,
        ktp_photo_url, selfie_photo_url, password,
        is_active, status, is_online, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        phone, fullName, nik, birthPlace, birthDate, address, rt, rw,
        kelurahan, kecamatan, agama, maritalStatus, email,
        vehicleType || 'motorcycle', vehicleColor, vehicleYear,
        bankName, accountNumber, accountName,
        ktpPhotoUrl, selfiePhotoUrl, hashedPassword,
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
