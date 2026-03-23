/**
 * Payment Routes
 * Handles Midtrans payment webhook/notification
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const crypto = require('crypto');
const { createTransaction } = require('../config/midtrans');

/**
 * Create Midtrans Payment Token (Snap Token)
 * POST /api/payment/create-token
 * 
 * Generates Snap token for payment page
 */
router.post('/create-token', async (req, res) => {
  try {
    const { booking_id, amount, customer_name, customer_email, customer_phone } = req.body;

    console.log('💳 Creating payment token for booking:', booking_id);

    // Convert amount to integer with ceiling (round up)
    // Midtrans IDR tidak boleh ada desimal/cent
    // Math.ceil() untuk memastikan driver/aplikasi tidak dirugikan dengan pembulatan
    const grossAmount = Math.ceil(parseFloat(amount) || 0);
    
    if (grossAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount - must be greater than 0'
      });
    }

    console.log(`💰 Amount: ${amount} → Converted: ${grossAmount} (IDR)`);

    // Generate unique order ID
    const orderId = `BOOK-${booking_id}-${Date.now()}`;

    // Prepare transaction details for Midtrans
    const transactionDetails = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      customer_details: {
        first_name: customer_name || 'Customer',
        email: customer_email || 'customer@hantar.com',
        phone: customer_phone || '08123456789',
      },
      item_details: [
        {
          id: `booking-${booking_id}`,
          price: grossAmount,
          quantity: 1,
          name: 'Hantar Delivery Service',
        },
      ],
      // Explicitly enable payment methods including QRIS
      enabled_payments: [
        'qris',           // QRIS (prioritas pertama)
        'gopay',
        'shopeepay', 
        'other_qris',     // QRIS dari bank lain
        'credit_card',
        'bca_va',
        'bni_va',
        'bri_va',
        'permata_va',
        'other_va',
      ],
      callbacks: {
        finish: 'https://hantar.app/payment/finish',
      },
    };

    // Create Snap token via Midtrans
    const result = await createTransaction(transactionDetails);

    if (!result.success) {
      throw new Error(result.message || 'Failed to create Snap token');
    }

    console.log('✅ Snap token created:', result.token);

    return res.json({
      success: true,
      token: result.token,
      redirect_url: result.redirect_url,
      order_id: orderId,
    });

  } catch (error) {
    console.error('❌ Error creating payment token:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment token',
    });
  }
});

/**
 * Midtrans Payment Notification Webhook
 * POST /api/payment/midtrans/notification
 * 
 * Called by Midtrans when payment status changes
 * Updates booking payment status and fills payment columns
 */
router.post('/midtrans/notification', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    console.error('❌ Database not available');
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }
  
  try {
    const notification = req.body;
    
    console.log('🔔 Midtrans Notification Received:', JSON.stringify(notification, null, 2));

    // Extract important data
    const {
      transaction_status,
      status_code,
      transaction_id,
      order_id,
      gross_amount,
      payment_type,
      transaction_time,
      signature_key,
      fraud_status
    } = notification;

    // Verify signature (untuk keamanan)
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex');

    if (signature_key !== expectedSignature) {
      console.error('❌ Invalid signature!');
      return res.status(403).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    // Handle test notification from Midtrans dashboard
    if (order_id && order_id.startsWith('payment_notif_test_')) {
      console.log('✅ Test notification from Midtrans dashboard - OK');
      return res.status(200).json({
        success: true,
        message: 'Test notification received successfully'
      });
    }

    // Parse booking_id from order_id (format: BOOK-{booking_id}-{timestamp})
    const bookingIdMatch = order_id.match(/BOOK-(\d+)-/);
    if (!bookingIdMatch) {
      console.error('❌ Invalid order_id format:', order_id);
      return res.status(400).json({
        success: false,
        message: 'Invalid order_id format'
      });
    }

    const bookingId = parseInt(bookingIdMatch[1]);
    console.log(`📦 Processing payment for booking ${bookingId}`);

    // Get current booking
    const [bookings] = await db.query(
      'SELECT * FROM independent_bookings WHERE id = ?',
      [bookingId]
    );

    if (bookings.length === 0) {
      console.error('❌ Booking not found:', bookingId);
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    // Determine payment status based on transaction_status
    let paymentStatus = 'pending';
    let bookingStatus = booking.booking_status;

    if (transaction_status === 'capture') {
      if (fraud_status === 'accept') {
        paymentStatus = 'paid';
        console.log('✅ Payment captured and accepted');
      }
    } else if (transaction_status === 'settlement') {
      paymentStatus = 'paid';
      console.log('✅ Payment settled');
    } else if (transaction_status === 'pending') {
      paymentStatus = 'pending';
      console.log('⏳ Payment pending');
    } else if (transaction_status === 'deny') {
      paymentStatus = 'failed';
      console.log('❌ Payment denied');
    } else if (transaction_status === 'expire') {
      paymentStatus = 'expired';
      console.log('⏰ Payment expired');
    } else if (transaction_status === 'cancel') {
      paymentStatus = 'cancelled';
      console.log('🚫 Payment cancelled');
    }

    // Update booking with payment information
    const updateQuery = `
      UPDATE independent_bookings 
      SET payment_status = ?,
          payment_transaction_id = ?,
          payment_transaction_status = ?,
          payment_transaction_time = ?,
          paid_at = ${paymentStatus === 'paid' ? 'NOW()' : 'paid_at'},
          updated_at = NOW()
      WHERE id = ?
    `;

    await db.query(updateQuery, [
      paymentStatus,
      transaction_id,
      transaction_status,
      transaction_time,
      bookingId
    ]);

    console.log(`✅ Booking ${bookingId} payment updated: ${paymentStatus}`);

    // If payment successful and booking is still pending, notify drivers
    if (paymentStatus === 'paid' && booking.booking_status === 'pending') {
      console.log('💳 Payment confirmed! Notifying drivers...');
      
      // Get nearby drivers (same logic as booking creation)
      const { sendNotificationToMultipleDrivers } = require('../services/notificationService');
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
        booking.pickup_lat, booking.pickup_lng, booking.pickup_lat,
        booking.vehicle_type,
        booking.pickup_lat, radiusDegrees, booking.pickup_lat, radiusDegrees,
        booking.pickup_lng, radiusDegrees, booking.pickup_lng, radiusDegrees
      ]);

      if (nearbyDrivers.length > 0) {
        console.log(`📍 Found ${nearbyDrivers.length} nearby drivers for booking ${bookingId}`);
        
        const fcmTokens = nearbyDrivers.map(d => d.fcm_token).filter(Boolean);
        
        if (fcmTokens.length > 0) {
          const notificationResult = await sendNotificationToMultipleDrivers(fcmTokens, {
            booking_id: bookingId,
            booking_code: booking.booking_code,
            vehicle_type: booking.vehicle_type,
            pickup_address: booking.pickup_address,
            dropoff_address: booking.dropoff_address,
            pickup_lat: booking.pickup_lat,
            pickup_lng: booking.pickup_lng,
            distance_km: booking.distance_km,
            total_fare: booking.total_fare,
            item_type: booking.item_type,
            item_size: booking.item_size
          });
          
          console.log('✅ Driver notifications sent:', notificationResult);

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
                  '🚚 Pesanan Baru (LUNAS)!',
                  `Pengiriman ${booking.item_type || 'paket'} - Jarak ${booking.distance_km}km`,
                  JSON.stringify({
                    booking_id: bookingId,
                    booking_code: booking.booking_code,
                    vehicle_type: booking.vehicle_type,
                    pickup_address: booking.pickup_address,
                    dropoff_address: booking.dropoff_address,
                    distance_km: booking.distance_km,
                    total_fare: booking.total_fare
                  })
                ]
              );
            } catch (notifError) {
              console.error('Error saving driver notification:', notifError);
            }
          }
        } else {
          console.log('⚠️ No FCM tokens available for nearby drivers');
        }
      } else {
        console.log('⚠️ No nearby drivers found for booking', bookingId);
      }
    }

    return res.json({
      success: true,
      message: 'Notification processed successfully',
      data: {
        booking_id: bookingId,
        payment_status: paymentStatus,
        transaction_id: transaction_id
      }
    });

  } catch (error) {
    console.error('❌ Error processing payment notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process notification',
      error: error.message
    });
  }
});

/**
 * Get payment status for a booking
 * GET /api/payment/status/:booking_id
 */
router.get('/status/:booking_id', async (req, res) => {
  try {
    const { booking_id } = req.params;

    const [bookings] = await db.query(
      `SELECT 
        id,
        booking_code,
        payment_status,
        payment_method,
        payment_transaction_id,
        payment_transaction_status,
        payment_transaction_time,
        total_price,
        driver_earnings,
        platform_fee,
        paid_at
      FROM independent_bookings 
      WHERE id = ?`,
      [booking_id]
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
    console.error('❌ Error getting payment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get payment status',
      error: error.message
    });
  }
});

module.exports = router;
