const express = require('express');
const router = express.Router();

/**
 * POST /api/bookings/delivery/create
 * Create a new delivery booking (antar paket)
 * Body: {
 *   customer_id, vehicle_type, pickup_address, dropoff_address,
 *   pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
 *   distance_km, total_fare, item_size, item_type, item_photo_url,
 *   recipient_name, recipient_phone, recipient_address_detail,
 *   recipient_note_to_driver, payment_method, demo_payment_success
 * }
 */
router.post('/delivery/create', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const {
      customer_id,
      vehicle_type,
      pickup_address,
      dropoff_address,
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
      distance_km,
      total_fare,
      item_size,
      item_type,
      item_photo_url,
      recipient_name,
      recipient_phone,
      recipient_address_detail,
      recipient_note_to_driver,
      payment_method,
      demo_payment_success
    } = req.body;

    console.log('📦 Creating delivery booking:', {
      customer_id,
      vehicle_type,
      pickup_address: pickup_address?.substring(0, 50),
      dropoff_address: dropoff_address?.substring(0, 50),
      distance_km,
      total_fare,
      payment_method
    });

    // Validate required fields
    if (!customer_id || !vehicle_type || !pickup_address || !dropoff_address) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customer_id, vehicle_type, pickup_address, dropoff_address'
      });
    }

    if (!pickup_lat || !pickup_lng || !dropoff_lat || !dropoff_lng) {
      return res.status(400).json({
        success: false,
        message: 'Missing coordinates: pickup_lat, pickup_lng, dropoff_lat, dropoff_lng'
      });
    }

    // Generate unique booking code
    const timestamp = Date.now();
    const bookingCode = `DELIVERY-${timestamp}`;

    // Get customer info
    const [customers] = await db.query(
      'SELECT full_name, email, phone FROM customers WHERE id = ?',
      [customer_id]
    );

    const customer = customers[0] || {};
    const customerName = customer.full_name || 'Guest';
    const customerPhone = customer.phone || '';
    const customerEmail = customer.email || '';

    // Normalize payment method to valid ENUM values
    // Valid values: 'cash', 'gopay', 'ovo', 'dana', 'shopeepay', 'linkaja', 'credit_card', 'bank_transfer'
    let normalizedPaymentMethod = 'cash'; // default
    if (payment_method) {
      const validMethods = ['cash', 'gopay', 'ovo', 'dana', 'shopeepay', 'linkaja', 'credit_card', 'bank_transfer'];
      if (validMethods.includes(payment_method.toLowerCase())) {
        normalizedPaymentMethod = payment_method.toLowerCase();
      }
    }

    // Payment status based on demo mode or payment method
    let paymentStatus = 'pending';
    let bookingStatus = 'pending';

    if (demo_payment_success) {
      paymentStatus = 'completed';
      bookingStatus = 'pending'; // Still pending, waiting for driver
    } else if (normalizedPaymentMethod === 'cash') {
      paymentStatus = 'pending'; // Will be paid on delivery
      bookingStatus = 'pending';
    }

    // Insert booking into independent_bookings table
    // booking_type should be 'package' for delivery (sesuai dengan ENUM di database)
    const insertQuery = `
      INSERT INTO independent_bookings (
        booking_code,
        booking_type,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        driver_id,
        driver_name,
        driver_phone,
        vehicle_type,
        pickup_location,
        pickup_address,
        pickup_lat,
        pickup_lng,
        dropoff_location,
        dropoff_address,
        dropoff_lat,
        dropoff_lng,
        distance_km,
        total_fare,
        item_size,
        item_type,
        item_photo_url,
        recipient_name,
        recipient_phone,
        recipient_address_detail,
        recipient_note_to_driver,
        payment_method,
        payment_status,
        booking_status,
        created_at,
        updated_at
      ) VALUES (?, 'package', ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [result] = await db.query(insertQuery, [
      bookingCode,
      customer_id,
      customerName,
      customerPhone,
      customerEmail,
      vehicle_type,
      'Pickup Location', // pickup_location (nama singkat)
      pickup_address,
      pickup_lat,
      pickup_lng,
      'Dropoff Location', // dropoff_location (nama singkat)
      dropoff_address,
      dropoff_lat,
      dropoff_lng,
      distance_km,
      total_fare,
      item_size,
      item_type,
      item_photo_url,
      recipient_name,
      recipient_phone,
      recipient_address_detail,
      recipient_note_to_driver,
      normalizedPaymentMethod, // Use normalized payment method
      paymentStatus,
      bookingStatus
    ]);

    const bookingId = result.insertId;

    console.log('✅ Delivery booking created:', {
      booking_id: bookingId,
      booking_code: bookingCode,
      payment_status: paymentStatus
    });

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Delivery booking created successfully',
      booking_id: bookingId,
      booking_code: bookingCode,
      payment_status: paymentStatus,
      booking_status: bookingStatus,
      data: {
        id: bookingId,
        booking_code: bookingCode,
        customer_id,
        vehicle_type,
        pickup_address,
        dropoff_address,
        distance_km,
        total_fare,
        payment_status: paymentStatus,
        status: bookingStatus
      }
    });

  } catch (error) {
    console.error('❌ Error creating delivery booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create delivery booking',
      error: error.message
    });
  }
});

/**
 * GET /api/bookings/delivery/:booking_id
 * Get delivery booking details
 */
router.get('/delivery/:booking_id', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const bookingId = req.params.booking_id;

    const [bookings] = await db.query(
      `SELECT 
        id,
        booking_code,
        booking_type,
        customer_id,
        customer_name,
        customer_phone,
        driver_id,
        vehicle_type,
        pickup_address,
        pickup_lat,
        pickup_lng,
        dropoff_address,
        dropoff_lat,
        dropoff_lng,
        distance_km,
        total_fare,
        item_size,
        item_type,
        item_photo_url,
        recipient_name,
        recipient_phone,
        recipient_address_detail,
        recipient_note_to_driver,
        payment_method,
        payment_status,
        booking_status,
        created_at,
        updated_at
      FROM independent_bookings
      WHERE id = ?`,
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    return res.json({
      success: true,
      data: bookings[0]
    });

  } catch (error) {
    console.error('❌ Error getting booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get booking',
      error: error.message
    });
  }
});

/**
 * GET /api/bookings/customer/:customer_id
 * Get all bookings for a customer (from independent_bookings)
 */
router.get('/customer/:customer_id', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const customerId = req.params.customer_id;

    const [bookings] = await db.query(
      `SELECT 
        id,
        booking_code,
        booking_type,
        vehicle_type,
        pickup_address,
        dropoff_address,
        distance_km,
        total_fare,
        payment_method,
        payment_status,
        booking_status,
        created_at
      FROM independent_bookings
      WHERE customer_id = ?
      ORDER BY created_at DESC`,
      [customerId]
    );

    return res.json({
      success: true,
      data: bookings
    });

  } catch (error) {
    console.error('❌ Error getting customer bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get bookings',
      error: error.message
    });
  }
});

/**
 * PATCH /api/bookings/:booking_id/status
 * Update booking status
 */
router.patch('/:booking_id/status', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const bookingId = req.params.booking_id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    await db.query(
      'UPDATE independent_bookings SET booking_status = ?, updated_at = NOW() WHERE id = ?',
      [status, bookingId]
    );

    return res.json({
      success: true,
      message: 'Booking status updated'
    });

  } catch (error) {
    console.error('❌ Error updating booking status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message
    });
  }
});

module.exports = router;
