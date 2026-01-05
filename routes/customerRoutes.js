const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

/**
 * POST /api/customer/register
 * Register new customer account
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

    // Insert into customers table
    const [result] = await db.query(
      `INSERT INTO customers (full_name, email, phone, password, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [full_name, email, phone || null, hashedPassword]
    );

    const customerId = result.insertId;

    // Also create a user record for compatibility (optional, based on your system)
    await db.query(
      `INSERT INTO users (email, password, user_type, created_at) 
       VALUES (?, ?, 'customer', NOW())`,
      [email, hashedPassword]
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        customer_id: customerId,
        full_name,
        email,
        phone
      }
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
 * Get all bookings for a customer with tracking coordinates
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
        b.id,
        b.travel_id,
        b.customer_id,
        b.student_id,
        b.seat_number,
        b.booking_status,
        b.status,
        b.pickup_lat,
        b.pickup_lng,
        b.pickup_location,
        b.pickup_address,
        b.dropoff_lat,
        b.dropoff_lng,
        b.dropoff_location,
        b.dropoff_address,
        b.booking_date,
        b.total_price,
        t.origin,
        t.destination,
        t.departure_date,
        t.departure_time,
        v.vehicle_number,
        v.vehicle_type,
        p.po_name,
        GROUP_CONCAT(bs.seat_number ORDER BY bs.seat_number) as seats
      FROM bookings b
      LEFT JOIN travels t ON b.travel_id = t.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN pos p ON v.po_id = p.id
      LEFT JOIN booking_seats bs ON b.id = bs.booking_id
      WHERE b.customer_id = ?
      GROUP BY b.id
      ORDER BY b.booking_date DESC
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
