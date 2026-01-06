/**
 * Payment Routes
 * Handles Midtrans payment webhook/notification
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const crypto = require('crypto');

/**
 * Midtrans Payment Notification Webhook
 * POST /api/payment/midtrans/notification
 * 
 * Called by Midtrans when payment status changes
 * Updates booking payment status and fills payment columns
 */
router.post('/midtrans/notification', async (req, res) => {
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

    // If payment successful and booking is still pending, update to accepted
    if (paymentStatus === 'paid' && booking.booking_status === 'pending') {
      console.log('💳 Payment confirmed, booking ready for driver acceptance');
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
