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
      rt, rw, kelurahan, kecamatan, religion, maritalStatus, email,
      vehicleType, vehicleColor, vehicleYear, vehiclePlate,
      bankName, accountNumber, accountName,
      ktpPhotoUrl, selfiePhotoUrl, simPhotoUrl, stnkPhotoUrl, 
      licenseNumber, stnkNumber,
      password
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
    
    // Validate vehicle requirements
    if (!vehiclePlate || !licenseNumber) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle plate and license number are required'
      });
    }
    
    // Validate SIM & STNK untuk kendaraan bermotor
    if (vehicleType !== 'bicycle' && vehicleType !== 'skateboard' && vehicleType !== 'scooter') {
      if (!simPhotoUrl || !stnkPhotoUrl || !stnkNumber) {
        return res.status(400).json({
          success: false,
          message: 'SIM photo, STNK photo, and STNK number are required for motor vehicles'
        });
      }
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const db = req.db;

    // Check if user with this phone/email already exists
    const [existingUsers] = await db.query(
      'SELECT id FROM users WHERE phone = ? OR email = ?',
      [phone, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Phone number or email already registered'
      });
    }

    // Check if NIK or license already used
    const [existingDrivers] = await db.query(
      'SELECT id FROM independent_drivers WHERE nik = ? OR license_number = ? OR vehicle_plate = ?',
      [nik, licenseNumber, vehiclePlate]
    );

    if (existingDrivers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'NIK, license number, or vehicle plate already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Create user account first
    const [userResult] = await db.query(
      `INSERT INTO users (
        full_name, email, phone, password, role, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'driver', 0, NOW(), NOW())`,
      [fullName, email, phone, hashedPassword]
    );

    const userId = userResult.insertId;

    // 2. Create driver profile linked to user
    const [driverResult] = await db.query(
      `INSERT INTO independent_drivers (
        user_id, full_name, phone, email, nik, 
        place_of_birth, date_of_birth, religion, marital_status,
        address_full, rt_rw, kelurahan, kecamatan,
        vehicle_type, vehicle_plate, vehicle_color, vehicle_year,
        license_number, license_photo_url, stnk_number, stnk_photo_url,
        bank_name, bank_account_number, bank_account_holder,
        ktp_photo_url, selfie_photo_url,
        is_verified, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        userId, fullName, phone, email, nik,
        birthPlace, birthDate, religion, maritalStatus,
        address, `${rt}/${rw}`, kelurahan, kecamatan,
        vehicleType || 'bicycle', vehiclePlate, vehicleColor, vehicleYear,
        licenseNumber, simPhotoUrl || null, stnkNumber || null, stnkPhotoUrl || null,
        bankName, accountNumber, accountName,
        ktpPhotoUrl, selfiePhotoUrl,
        false // not verified until admin approval
      ]
    );

    const driverId = driverResult.insertId;

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Admin will review your request within 24 hours.',
      user_id: userId,
      driver_id: driverId,
      status: 'pending'
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
 * POST /api/driver-auth/login
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

    // Find user by phone with role driver
    const [users] = await db.query(
      `SELECT u.id, u.phone, u.full_name, u.password, u.is_active, u.role,
              d.id as driver_id, d.rating, d.total_trips, d.status, d.is_verified
       FROM users u
       LEFT JOIN independent_drivers d ON u.id = d.user_id
       WHERE u.phone = ? AND u.role = 'driver'`,
      [phone]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone or password'
      });
    }

    const user = users[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not yet approved. Please wait for admin verification.',
        status: user.status || 'pending'
      });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
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
        userId: user.id,
        driverId: user.driver_id,
        phone: user.phone,
        fullName: user.full_name,
        rating: user.rating || 0,
        totalTrips: user.total_trips || 0,
        isVerified: user.is_verified || false,
        status: user.status
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
