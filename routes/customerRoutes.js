const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { generateOTP, sendOTPEmail } = require('../services/emailService');

/**
 * POST /api/customer/register
 * Register new customer account and send OTP email
 * Body: { full_name, email, phone, password }
 */
router.post('/register', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const { full_name, email, phone, password } = req.body;

    // Validate required fields
    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Check if email already exists in customers table
    const [existingCustomer] = await db.query(
      'SELECT id FROM customers WHERE email = ?',
      [email]
    );

    if (existingCustomer.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into customers table (email_verified=0, is_active=0 by default)
    const [result] = await db.query(
      `INSERT INTO customers (full_name, email, phone, password, email_verified, is_active, created_at) 
       VALUES (?, ?, ?, ?, 0, 0, NOW())`,
      [full_name, email, phone || null, hashedPassword]
    );

    const customerId = result.insertId;

    // Generate OTP code
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Save OTP to database
    await db.query(
      `INSERT INTO otp_verifications (email, otp_code, expires_at, verified, attempts) 
       VALUES (?, ?, ?, 0, 0)
       ON DUPLICATE KEY UPDATE 
       otp_code = VALUES(otp_code), 
       expires_at = VALUES(expires_at), 
       verified = 0, 
       attempts = 0,
       created_at = CURRENT_TIMESTAMP`,
      [email, otpCode, expiresAt]
    );

    // Send OTP email
    try {
      await sendOTPEmail(email, otpCode);
      console.log(`✅ OTP sent to ${email}: ${otpCode}`);
    } catch (emailError) {
      console.error('❌ Failed to send OTP email:', emailError);
      // Continue anyway - user can request resend
    }

    // Also create a user record for compatibility (optional)
    try {
      await db.query(
        `INSERT INTO users (email, username, password, user_type, created_at) 
         VALUES (?, ?, ?, 'customer', NOW())`,
        [email, email.split('@')[0], hashedPassword]
      );
    } catch (userInsertError) {
      console.log('⚠️  Users table insert skipped:', userInsertError.message);
    }

    return res.status(201).json({
      success: true,
      message: `Registrasi berhasil! Kode OTP telah dikirim ke ${email}`,
      data: {
        customer_id: customerId,
        full_name,
        email,
        phone
      },
      expiresIn: '5 menit',
      mode: process.env.EMAIL_MODE || 'testing'
    });

  } catch (error) {
    console.error('❌ Customer registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

/**
 * POST /api/customer/login
 * Customer login with email and password
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const { email, password } = req.body;

    console.log('🔐 Customer login attempt:', { email });

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find customer by email
    const [customers] = await db.query(
      'SELECT id, full_name, email, phone, password FROM customers WHERE email = ?',
      [email]
    );

    if (customers.length === 0) {
      console.log('❌ Customer not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const customer = customers[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, customer.password);

    if (!validPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ Customer login successful:', customer.id);

    // Return customer data (without password)
    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        customer_id: customer.id,
        full_name: customer.full_name,
        email: customer.email,
        phone: customer.phone
      }
    });

  } catch (error) {
    console.error('❌ Customer login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

/**
 * GET /api/customer/bookings/:customer_id
 * Get all transaction history for a customer from independent_bookings
 * Shows: ride, delivery, cargo, food bookings - organized by booking_type
 */
router.get('/bookings/:customer_id', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const customerId = req.params.customer_id;

    const query = `
      SELECT 
        id,
        booking_code,
        booking_type,
        customer_id,
        customer_name,
        customer_phone,
        driver_id,
        driver_name,
        pickup_lat,
        pickup_lng,
        pickup_location,
        pickup_address,
        dropoff_lat,
        dropoff_lng,
        dropoff_location,
        dropoff_address,
        distance_km,
        total_price,
        driver_earnings,
        booking_status,
        payment_status,
        payment_method,
        created_at,
        completed_at,
        customer_rating,
        vehicle_type,
        item_type,
        item_size
      FROM independent_bookings
      WHERE customer_id = ?
      ORDER BY created_at DESC
    `;

    const [bookings] = await db.query(query, [customerId]);

    return res.json({
      success: true,
      data: bookings
    });

  } catch (error) {
    console.error('❌ Get customer bookings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get bookings',
      error: error.message
    });
  }
});

/**
 * POST /api/customer/verify-otp
 * Verify OTP code and activate customer account
 * Body: { email, otpCode }
 */
router.post('/verify-otp', async (req, res) => {
  const db = req.db;
  const jwt = require('jsonwebtoken');
  const { sendWelcomeEmail } = require('../services/emailService');
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP code are required'
      });
    }

    // Get OTP verification record
    const [otpRecords] = await db.query(
      'SELECT * FROM otp_verifications WHERE email = ? ORDER BY created_at DESC LIMIT 1',
      [email]
    );

    if (otpRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Kode OTP tidak ditemukan. Silakan daftar ulang.'
      });
    }

    const otpRecord = otpRecords[0];

    // Check if already verified
    if (otpRecord.verified) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah diverifikasi. Silakan login.'
      });
    }

    // Check if expired
    if (new Date() > new Date(otpRecord.expires_at)) {
      return res.status(400).json({
        success: false,
        message: 'Kode OTP sudah kadaluarsa. Silakan minta kode baru.'
      });
    }

    // Check max attempts
    if (otpRecord.attempts >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Maksimal percobaan verifikasi tercapai. Silakan minta kode baru.'
      });
    }

    // Verify OTP code
    if (otpRecord.otp_code !== otpCode) {
      // Increment attempts
      await db.query(
        'UPDATE otp_verifications SET attempts = attempts + 1 WHERE email = ?',
        [email]
      );

      return res.status(400).json({
        success: false,
        message: `Kode OTP salah. Sisa percobaan: ${2 - otpRecord.attempts}`
      });
    }

    // OTP is valid! Activate customer account
    await db.query(
      'UPDATE customers SET email_verified = 1, is_active = 1 WHERE email = ?',
      [email]
    );

    // Mark OTP as verified
    await db.query(
      'UPDATE otp_verifications SET verified = 1 WHERE email = ?',
      [email]
    );

    // Get customer data
    const [customers] = await db.query(
      'SELECT id, full_name, email, phone FROM customers WHERE email = ?',
      [email]
    );

    const customer = customers[0];

    // Generate JWT token for auto-login
    const token = jwt.sign(
      { 
        customerId: customer.id, 
        email: customer.email,
        userType: 'customer'
      },
      process.env.JWT_SECRET || 'hantar-travel-secret-key-2025',
      { expiresIn: '30d' }
    );

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, customer.full_name).catch(err => {
      console.error('⚠️  Failed to send welcome email:', err);
    });

    return res.status(200).json({
      success: true,
      message: 'Verifikasi berhasil! Akun Anda telah aktif.',
      token,
      customer: {
        id: customer.id,
        full_name: customer.full_name,
        email: customer.email,
        phone: customer.phone
      }
    });

  } catch (error) {
    console.error('❌ OTP verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Verifikasi gagal',
      error: error.message
    });
  }
});

/**
 * POST /api/customer/resend-otp
 * Resend OTP code to email
 * Body: { email }
 */
router.post('/resend-otp', async (req, res) => {
  const db = req.db;
  const { generateOTP, sendOTPEmail } = require('../services/emailService');
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if customer exists
    const [customers] = await db.query(
      'SELECT id, email_verified FROM customers WHERE email = ?',
      [email]
    );

    if (customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email tidak terdaftar'
      });
    }

    // Check if already verified
    if (customers[0].email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah diverifikasi. Silakan login.'
      });
    }

    // Check rate limiting - 60 seconds cooldown
    const [recentOTP] = await db.query(
      'SELECT created_at FROM otp_verifications WHERE email = ? ORDER BY created_at DESC LIMIT 1',
      [email]
    );

    if (recentOTP.length > 0) {
      const timeSinceLastOTP = Date.now() - new Date(recentOTP[0].created_at).getTime();
      const cooldownSeconds = 60;
      
      if (timeSinceLastOTP < cooldownSeconds * 1000) {
        const remainingSeconds = Math.ceil((cooldownSeconds * 1000 - timeSinceLastOTP) / 1000);
        return res.status(429).json({
          success: false,
          message: `Silakan tunggu ${remainingSeconds} detik sebelum meminta kode baru`
        });
      }
    }

    // Generate new OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Update or insert OTP
    await db.query(
      `INSERT INTO otp_verifications (email, otp_code, expires_at, verified, attempts) 
       VALUES (?, ?, ?, 0, 0)
       ON DUPLICATE KEY UPDATE 
       otp_code = VALUES(otp_code), 
       expires_at = VALUES(expires_at), 
       verified = 0, 
       attempts = 0,
       created_at = CURRENT_TIMESTAMP`,
      [email, otpCode, expiresAt]
    );

    // Send OTP email
    try {
      await sendOTPEmail(email, otpCode);
      console.log(`✅ OTP resent to ${email}: ${otpCode}`);
    } catch (emailError) {
      console.error('❌ Failed to resend OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengirim email. Silakan coba lagi.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Kode OTP baru telah dikirim ke ${email}`,
      expiresIn: '5 menit',
      mode: process.env.EMAIL_MODE || 'testing'
    });

  } catch (error) {
    console.error('❌ Resend OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengirim ulang kode OTP',
      error: error.message
    });
  }
});

/**
 * GET /api/customer/:customer_id
 * Get customer profile by ID
 */
router.get('/:customer_id', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const customerId = req.params.customer_id;

    const [customers] = await db.query(
      'SELECT id, full_name, email, phone, created_at FROM customers WHERE id = ?',
      [customerId]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    return res.json({
      success: true,
      data: customers[0]
    });

  } catch (error) {
    console.error('❌ Get customer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get customer',
      error: error.message
    });
  }
});

module.exports = router;
