const express = require('express');
const router = express.Router();
const db = require('../config/database');
const {
  sendNotificationToMultipleDrivers,
  sendBookingTakenNotificationToDriver,
} = require('../services/notificationService');

async function notifyOtherDriversBookingTaken(bookingId, acceptedDriverId, acceptedDriverName) {
  try {
    const [otherDrivers] = await db.query(
      `SELECT DISTINCT dn.driver_id, d.fcm_token
       FROM driver_notifications dn
       JOIN independent_drivers d ON d.id = dn.driver_id
       WHERE dn.booking_id = ?
         AND dn.driver_id != ?
         AND d.fcm_token IS NOT NULL`,
      [bookingId, acceptedDriverId]
    );

    if (!otherDrivers.length) {
      return;
    }

    await Promise.all(
      otherDrivers.map(async (driverRow) => {
        await sendBookingTakenNotificationToDriver(driverRow.fcm_token, {
          booking_id: bookingId,
          taken_by_driver: acceptedDriverName,
        });

        await db.query(
          `INSERT INTO driver_notifications
            (driver_id, booking_id, notification_type, title, message, data, is_read, created_at)
           VALUES (?, ?, 'booking_taken', ?, ?, ?, 0, NOW())`,
          [
            driverRow.driver_id,
            bookingId,
            '⚠️ Pesanan Sudah Diambil',
            'Pesanan ini sudah diambil driver lain. Tunggu order berikutnya ya.',
            JSON.stringify({
              booking_id: bookingId,
              type: 'booking_taken',
              taken_by_driver: acceptedDriverName,
            }),
          ]
        );
      })
    );

    await db.query(
      `UPDATE driver_notifications
       SET is_read = 1
       WHERE booking_id = ?
         AND driver_id != ?
         AND notification_type = 'new_booking'
         AND is_read = 0`,
      [bookingId, acceptedDriverId]
    );

    console.log(`✅ Notified ${otherDrivers.length} non-winning driver(s) for booking ${bookingId}`);
  } catch (error) {
    console.error(`⚠️ Failed notifying non-winning drivers for booking ${bookingId}:`, error.message);
  }
}

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
      service_type,
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
      service_type,
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
    // Database ENUM: 'cash', 'midtrans', 'wallet', 'bank_transfer'
    let normalizedPaymentMethod = 'cash'; // default
    if (payment_method) {
      const method = payment_method.toLowerCase();
      
      // E-wallet methods that will be processed via Midtrans
      const eWalletMethods = ['gopay', 'ovo', 'dana', 'shopeepay', 'linkaja', 'qris'];
      
      if (method === 'cash') {
        normalizedPaymentMethod = 'cash';
      } else if (eWalletMethods.includes(method)) {
        // If demo mode, store as 'wallet', otherwise 'midtrans' (will be processed by Midtrans)
        normalizedPaymentMethod = demo_payment_success ? 'wallet' : 'midtrans';
      } else if (method === 'midtrans' || method === 'credit_card') {
        normalizedPaymentMethod = 'midtrans';
      } else if (method === 'bank_transfer') {
        normalizedPaymentMethod = 'bank_transfer';
      } else if (method === 'wallet') {
        normalizedPaymentMethod = 'wallet';
      }
    }

    // Payment status based on demo mode or payment method
    // Valid ENUM values: 'unpaid', 'paid', 'refunded', 'cancelled'
    let paymentStatus = 'unpaid'; // default
    let bookingStatus = 'pending';

    if (demo_payment_success) {
      paymentStatus = 'paid';
      bookingStatus = 'pending'; // Still pending, waiting for driver
    } else if (normalizedPaymentMethod === 'cash') {
      paymentStatus = 'unpaid'; // Will be paid on delivery
      bookingStatus = 'pending';
    }

    // Determine booking_type with explicit service type support.
    // Priority: service_type=cargo -> cargo.
    // Fallback: motorcycle without item_type -> ride, else delivery.
    let actualBookingType = 'delivery'; // default for antar paket
    if (service_type === 'cargo') {
      actualBookingType = 'cargo';
    } else if (vehicle_type === 'motorcycle' && !item_type) {
      actualBookingType = 'ride'; // instant ride motor/passenger
    }

    // Insert booking into independent_bookings table
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
        base_price,
        total_price,
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
        pickup_datetime,
        created_at,
        updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, 
        NULL, '', '',
        ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, 
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, 
        ?, ?, ?, ?,
        NOW(), NOW(), NOW()
      )
    `;

    const [result] = await db.query(insertQuery, [
      bookingCode,           // 1
      actualBookingType,     // 2 - 'ride', 'delivery', or 'cargo'
      customer_id,           // 3
      customerName,          // 4
      customerPhone,         // 5
      customerEmail,         // 6
      vehicle_type,          // 7
      'Pickup Location',     // 7
      pickup_address,        // 8
      pickup_lat,            // 9
      pickup_lng,            // 10
      'Dropoff Location',    // 11
      dropoff_address,       // 12
      dropoff_lat,           // 13
      dropoff_lng,           // 14
      distance_km,           // 15
      total_fare,            // 16
      total_fare,            // 17 (base_price = total_fare)
      total_fare,            // 18 (total_price = total_fare)
      item_size,             // 19
      item_type,             // 20
      item_photo_url,        // 21
      recipient_name,        // 22
      recipient_phone,       // 23
      recipient_address_detail,  // 24
      recipient_note_to_driver,  // 25
      normalizedPaymentMethod,   // 26
      paymentStatus,         // 27
      bookingStatus          // 28
    ]);

    const bookingId = result.insertId;

    console.log('✅ Delivery booking created:', {
      booking_id: bookingId,
      booking_code: bookingCode,
      payment_status: paymentStatus
    });

    // Find nearby available drivers and send notifications
    try {
      console.log('📲 Finding nearby drivers...');
      
      // Get drivers within 10km radius who are active
      // Use subquery to get latest location per driver
      const SEARCH_RADIUS_KM = 5;
      const radiusDegrees = SEARCH_RADIUS_KM / 111; // ~5km radius
      
      const [nearbyDrivers] = await db.query(`
        SELECT d.id, d.fcm_token, d.full_name, d.vehicle_type,
               dl.latitude, dl.longitude,
               (6371 * acos(
                 cos(radians(?)) * cos(radians(dl.latitude)) *
                 cos(radians(dl.longitude) - radians(?)) +
                 sin(radians(?)) * sin(radians(dl.latitude))
               )) AS distance_km
        FROM independent_drivers d
        INNER JOIN driver_locations dl ON d.id = dl.driver_id
        INNER JOIN (
          SELECT driver_id, MAX(created_at) as max_created
          FROM driver_locations
          WHERE is_active = 1
          GROUP BY driver_id
        ) latest ON dl.driver_id = latest.driver_id AND dl.created_at = latest.max_created
        WHERE d.status = 'active'
          AND d.vehicle_type = ?
          AND d.fcm_token IS NOT NULL
          AND dl.is_active = 1
          AND dl.latitude IS NOT NULL
          AND dl.longitude IS NOT NULL
          AND dl.latitude BETWEEN ? - ? AND ? + ?
          AND dl.longitude BETWEEN ? - ? AND ? + ?
        HAVING distance_km <= ${SEARCH_RADIUS_KM}
        ORDER BY distance_km ASC
        LIMIT 10
      `, [
        pickup_lat, pickup_lng, pickup_lat, // For distance calculation
        vehicle_type, // Match vehicle type
        pickup_lat, radiusDegrees, pickup_lat, radiusDegrees, // Lat bounds
        pickup_lng, radiusDegrees, pickup_lng, radiusDegrees  // Lng bounds
      ]);

      if (nearbyDrivers.length > 0) {
        console.log(`📍 Found ${nearbyDrivers.length} nearby drivers`);
        
        // Untuk CASH payment, kirim notifikasi langsung
        // Untuk Midtrans payment, notifikasi dikirim dari webhook setelah payment berhasil
        if (normalizedPaymentMethod === 'cash') {
          console.log('💰 CASH payment - sending notifications immediately');
          
          const fcmTokens = nearbyDrivers.map(d => d.fcm_token).filter(Boolean);
          
          if (fcmTokens.length > 0) {
            const notificationResult = await sendNotificationToMultipleDrivers(fcmTokens, {
              booking_id: bookingId,
              booking_code: bookingCode,
              vehicle_type,
              pickup_address,
              dropoff_address,
              pickup_lat,
              pickup_lng,
              distance_km,
              total_fare,
              item_type,
              item_size
            });
            
            console.log('✅ Notifications sent:', notificationResult);

            // Save notification to database for each driver
            for (const driver of nearbyDrivers) {
              try {
                await db.query(
                  `INSERT INTO driver_notifications 
                    (driver_id, booking_id, notification_type, title, message, data, created_at)
                  VALUES (?, ?, 'new_booking', ?, ?, ?, NOW())`,
                  [
                    driver.id,
                    bookingId,
                    '🚚 Pesanan Baru!',
                    `Pengiriman ${item_type} - Jarak ${distance_km}km`,
                    JSON.stringify({
                      booking_id: bookingId,
                      booking_code: bookingCode,
                      vehicle_type,
                      pickup_address,
                      dropoff_address,
                      distance_km,
                      total_price: total_fare,
                      item_type,
                      item_size,
                      customer_name: customerName
                    })
                  ]
                );
                console.log(`✅ Notification saved to DB for driver ${driver.id}`);
              } catch (dbError) {
                console.error(`⚠️ Failed to save notification for driver ${driver.id}:`, dbError.message);
              }
            }
          }
        } else {
          // Midtrans payment - notifikasi dikirim dari webhook setelah payment berhasil
          console.log('⏳ Midtrans payment - driver notifications will be sent after payment confirmation');
        }
      } else {
        console.log('⚠️ No nearby drivers found');
      }
    } catch (notifError) {
      // Don't fail the booking if notification fails
      console.error('⚠️ Failed to send notifications:', notifError.message);
    }

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

/** * GET /api/bookings/:booking_id
 * Get booking details by ID (for driver app)
 */
router.get('/:booking_id', async (req, res) => {
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
      WHERE id = ? OR booking_code = ?`,
      [bookingId, bookingId]
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

/** * GET /api/bookings/delivery/:booking_id
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
      WHERE id = ? OR booking_code = ?`,
      [bookingId, bookingId]
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
        driver_id,
        driver_name,
        driver_phone,
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

/**
 * POST /api/bookings/:booking_id/accept
 * Driver accepts a booking
 */
router.post('/:booking_id/accept', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const bookingId = req.params.booking_id;
    const { driver_id } = req.body;

    if (!driver_id) {
      return res.status(400).json({
        success: false,
        message: 'driver_id is required'
      });
    }

    // Get driver info (use independent_drivers as authoritative)
    const [drivers] = await db.query(
      'SELECT id, full_name, phone, vehicle_type FROM independent_drivers WHERE id = ?',
      [driver_id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = drivers[0];

    const [bookings] = await db.query(
      'SELECT id, booking_code FROM independent_bookings WHERE id = ?',
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Atomic assignment to avoid race condition when multiple drivers accept at same time
    const [assignResult] = await db.query(
      `UPDATE independent_bookings 
       SET driver_id = ?, 
           driver_name = ?,
           driver_phone = ?,
           booking_status = 'accepted',
           updated_at = NOW()
       WHERE id = ?
         AND driver_id IS NULL
         AND booking_status IN ('pending', 'searching')`,
      [driver_id, driver.full_name, driver.phone, bookingId]
    );

    if (assignResult.affectedRows === 0) {
      const [latestBookingRows] = await db.query(
        `SELECT ib.booking_status, ib.driver_id, d.full_name AS accepted_driver_name
         FROM independent_bookings ib
         LEFT JOIN independent_drivers d ON d.id = ib.driver_id
         WHERE ib.id = ?`,
        [bookingId]
      );

      const latestBooking = latestBookingRows[0] || {};
      return res.status(409).json({
        success: false,
        message: latestBooking.driver_id
          ? 'Booking already accepted by another driver'
          : `Booking is no longer available (${latestBooking.booking_status || 'updated'})`,
        data: {
          booking_id: bookingId,
          status: latestBooking.booking_status || 'updated',
          accepted_driver_id: latestBooking.driver_id || null,
          accepted_driver_name: latestBooking.accepted_driver_name || null,
        }
      });
    }

    // Update driver availability (if column exists)
    // Note: independent_drivers may not have is_available column
    // await db.query(
    //   'UPDATE independent_drivers SET is_available = 0, updated_at = NOW() WHERE id = ?',
    //   [driver_id]
    // );

    console.log(`✅ Booking ${bookingId} accepted by driver ${driver_id}`);

    // Create chat room for customer-driver communication
    try {
      // Get booking details for chat room (including booking_type)
      const [bookingDetails] = await db.query(
        'SELECT customer_id, booking_code, booking_type FROM independent_bookings WHERE id = ?',
        [bookingId]
      );

      if (bookingDetails.length > 0) {
        const booking = bookingDetails[0];
        
        // Check if chat room already exists
        const [existingRoom] = await db.query(
          'SELECT id FROM chat_rooms WHERE booking_id = ? AND booking_type = ?',
          [bookingId, booking.booking_type]
        );

        if (existingRoom.length === 0) {
          // Create new chat room
          await db.query(
            `INSERT INTO chat_rooms 
              (booking_id, booking_type, customer_id, driver_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'active', NOW(), NOW())`,
            [bookingId, booking.booking_type, booking.customer_id, driver_id]
          );
          console.log(`✅ Chat room created for booking ${bookingId}`);
        } else {
          console.log(`ℹ️ Chat room already exists for booking ${bookingId}`);
        }
      }
    } catch (chatError) {
      console.error('⚠️ Failed to create chat room:', chatError.message);
      // Don't fail the booking acceptance if chat room creation fails
    }

    const booking = bookings[0];
    notifyOtherDriversBookingTaken(
      booking.id,
      driver_id,
      driver.full_name
    );

    return res.json({
      success: true,
      message: 'Booking accepted successfully',
      data: {
        booking_id: bookingId,
        driver_id: driver_id,
        driver_name: driver.full_name,
        status: 'accepted'
      }
    });

  } catch (error) {
    console.error('❌ Error accepting booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept booking',
      error: error.message
    });
  }
});

/**
 * POST /api/bookings/:booking_id/reject
 * Driver rejects a booking offer without cancelling customer booking
 */
router.post('/:booking_id/reject', async (req, res) => {
  const db = req.db;

  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const bookingId = req.params.booking_id;
    const { driver_id, reason } = req.body;

    if (!driver_id) {
      return res.status(400).json({
        success: false,
        message: 'driver_id is required'
      });
    }

    const [bookings] = await db.query(
      'SELECT id, booking_status, driver_id FROM independent_bookings WHERE id = ?',
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    if (['completed', 'cancelled'].includes(booking.booking_status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot reject booking with status: ${booking.booking_status}`
      });
    }

    if (['accepted', 'assigned', 'in_progress'].includes(booking.booking_status)) {
      return res.status(409).json({
        success: false,
        message: `Booking already handled with status: ${booking.booking_status}`
      });
    }

    // Record rejection for analytics (if table exists)
    try {
      await db.query(
        `INSERT INTO driver_order_rejections
         (driver_id, booking_id, reason, rejected_at)
         VALUES (?, ?, ?, NOW())`,
        [driver_id, bookingId, reason || 'Driver rejected']
      );
    } catch (error) {
      console.warn('⚠️ Could not save driver rejection record:', error.message);
    }

    // Update driver rejection stats when column exists
    try {
      await db.query(
        `UPDATE independent_drivers
         SET total_rejections = COALESCE(total_rejections, 0) + 1,
             updated_at = NOW()
         WHERE id = ?`,
        [driver_id]
      );
    } catch (error) {
      console.warn('⚠️ Could not update total_rejections:', error.message);
    }

    // End customer search immediately when driver rejects this offer.
    await db.query(
      `UPDATE independent_bookings
       SET booking_status = 'cancelled',
           cancellation_reason = ?,
           cancelled_by = 'driver',
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [reason || 'Driver rejected', bookingId]
    );

    return res.json({
      success: true,
      message: 'Order ditolak. Pencarian driver customer dihentikan.',
      data: {
        booking_id: bookingId,
        status: 'cancelled',
      }
    });
  } catch (error) {
    console.error('❌ Error rejecting booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject booking',
      error: error.message
    });
  }
});

/**
 * PUT /api/bookings/:booking_id/cancel
 * Cancel a booking (customer or driver)
 */
router.put('/:booking_id/cancel', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const bookingId = req.params.booking_id;
    const { reason, cancelled_by } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'booking_id is required'
      });
    }

    // Get current booking status + payment info for potential refund
    const [bookings] = await db.query(
      `SELECT booking_status, driver_id, payment_status, payment_method,
              payment_transaction_id, payment_transaction_status
       FROM independent_bookings WHERE id = ?`,
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    // Idempotent cancel: if already cancelled, return success to avoid UX errors
    if (booking.booking_status === 'cancelled') {
      return res.json({
        success: true,
        message: 'Booking already cancelled',
        data: {
          booking_id: bookingId,
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        }
      });
    }

    // Only allow cancellation if booking is pending or accepted
    if (!['pending', 'accepted', 'searching'].includes(booking.booking_status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status: ${booking.booking_status}`
      });
    }

    // Update booking status to cancelled
    await db.query(
      `UPDATE independent_bookings 
       SET booking_status = 'cancelled',
           cancellation_reason = ?,
           cancelled_by = ?,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [reason || 'No reason provided', cancelled_by || 'customer', bookingId]
    );

    // If driver was assigned, make driver available again
    if (booking.driver_id) {
      await db.query(
        'UPDATE drivers SET is_available = 1, updated_at = NOW() WHERE id = ?',
        [booking.driver_id]
      );
      console.log(`✅ Driver ${booking.driver_id} set back to available`);
    }

    console.log(`✅ Booking ${bookingId} cancelled by ${cancelled_by || 'customer'}`);

    // --- REFUND LOGIC ---
    let refundInfo = null;

    if (booking.payment_status === 'paid' && booking.payment_method === 'midtrans' && booking.payment_transaction_id) {
      try {
        const { coreApi } = require('../config/midtrans');

        if (booking.payment_transaction_status === 'authorize') {
          // Authorized but not yet captured — use cancel API
          await coreApi.transaction.cancel(booking.payment_transaction_id);
          console.log(`💰 Midtrans payment cancelled (pre-capture) for booking ${bookingId}`);
        } else {
          // Already captured/settled — use refund API
          await coreApi.transaction.refund(booking.payment_transaction_id, {
            refund_key: `REFUND-${bookingId}-${Date.now()}`,
            reason: reason || 'Customer cancellation',
          });
          console.log(`💰 Midtrans refund requested for booking ${bookingId}`);
        }

        await db.query(
          `UPDATE independent_bookings SET payment_status = 'refunded', updated_at = NOW() WHERE id = ?`,
          [bookingId]
        );

        refundInfo = {
          status: 'refunded',
          message: 'Refund berhasil diproses. Dana akan kembali dalam 1–7 hari kerja sesuai metode pembayaran.',
        };
      } catch (refundError) {
        // Refund failed — flag for manual admin review, do NOT block the cancellation
        console.error(`❌ Auto-refund failed for booking ${bookingId}:`, refundError.message);
        // Keep payment_status = 'paid' so admin can identify bookings needing manual refund
        // (cancelled booking + payment_status='paid' = pending manual refund)
        refundInfo = {
          status: 'pending_manual',
          message: 'Pembatalan berhasil. Proses pengembalian dana sedang ditinjau oleh admin.',
        };
      }
    } else if (booking.payment_status === 'paid' && booking.payment_method === 'cash') {
      refundInfo = {
        status: 'manual',
        message: 'Pembayaran tunai — pengembalian dana dilakukan langsung oleh driver atau admin.',
      };
    }

    return res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        booking_id: bookingId,
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        refund: refundInfo,
      }
    });

  } catch (error) {
    console.error('❌ Error cancelling booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error.message
    });
  }
});

/**
 * Complete booking (driver finishes trip)
 * POST /api/bookings/:booking_id/complete
 * 
 * Calculates driver_earnings (80%) and platform_fee (20%)
 * Updates booking status to 'completed'
 */
router.post('/:booking_id/complete', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const { booking_id } = req.params;
    const { driver_id } = req.body;

    console.log(`🏁 Completing booking ${booking_id} by driver ${driver_id}`);

    // Validate required fields
    if (!driver_id) {
      return res.status(400).json({
        success: false,
        message: 'driver_id is required'
      });
    }

    // Check if booking exists
    const [bookings] = await db.query(
      'SELECT * FROM independent_bookings WHERE id = ?',
      [booking_id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    // Verify driver owns this booking
    if (booking.driver_id !== parseInt(driver_id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this booking'
      });
    }

    // Only allow completion if booking is accepted or in_progress
    if (!['accepted', 'in_progress'].includes(booking.booking_status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete booking with status: ${booking.booking_status}`
      });
    }

    // Get pricing info from database to calculate correct percentages
    const [pricingRows] = await db.query(
      `SELECT driver_percentage, platform_percentage 
       FROM service_vehicle_pricing 
       WHERE vehicle_type = ? AND is_active = 1
       LIMIT 1`,
      [booking.vehicle_type]
    );

    // Fallback default split if pricing not configured
    const hasPricing = pricingRows.length > 0;
    const pricing = hasPricing ? pricingRows[0] : { driver_percentage: 80, platform_percentage: 20 };
    const driverPercentage = parseFloat(pricing.driver_percentage) || 80;
    const platformFeePercentage = parseFloat(pricing.platform_percentage) || 20;

    if (!hasPricing) {
      console.warn(`⚠️ Pricing configuration missing for vehicle: ${booking.vehicle_type}, using default split 80/20`);
    }

    // Validate that percentages add up to 100
    if (driverPercentage + platformFeePercentage !== 100) {
      console.warn(`⚠️ Warning: Percentages don't add up to 100: driver=${driverPercentage}%, platform=${platformFeePercentage}%`);
    }

    // Calculate earnings based on database percentages
    const totalPrice = parseFloat(booking.total_price) || 0;
    const driverEarnings = (totalPrice * driverPercentage) / 100;
    const platformFee = (totalPrice * platformFeePercentage) / 100;

    console.log(`💰 Total: ${totalPrice}, Driver: ${driverEarnings} (${driverPercentage}%), Platform: ${platformFee} (${platformFeePercentage}%)`);

    // Update booking with earnings and status
    await db.query(
      `UPDATE independent_bookings 
       SET booking_status = 'completed',
           driver_earnings = ?,
           platform_fee = ?,
           platform_fee_percentage = ?,
           completed_at = NOW(),
           actual_dropoff_datetime = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [driverEarnings, platformFee, platformFeePercentage, booking_id]
    );

    // Make driver available again (table may not have is_available column in current schema)
    try {
      await db.query(
        'UPDATE independent_drivers SET updated_at = NOW() WHERE id = ?',
        [driver_id]
      );
    } catch (err) {
      console.warn('⚠️ Could not update driver availability (column may be missing):', err.message);
    }

    console.log(`✅ Booking ${booking_id} completed successfully`);
    console.log(`✅ Driver ${driver_id} earned: Rp ${driverEarnings.toLocaleString()}`);

    return res.json({
      success: true,
      message: 'Booking completed successfully',
      data: {
        booking_id: booking_id,
        status: 'completed',
        total_price: totalPrice,
        driver_earnings: driverEarnings,
        platform_fee: platformFee,
        completed_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error completing booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete booking',
      error: error.message
    });
  }
});

module.exports = router;
