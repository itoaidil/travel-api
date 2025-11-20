/**
 * Payment Gateway Routes
 * 
 * Endpoints untuk integrasi Midtrans payment gateway
 * - Create payment token
 * - Handle payment notification (webhook)
 * - Check payment status
 */

const express = require('express');
const router = express.Router();
const {
  createTransaction,
  checkTransactionStatus,
  verifySignature,
  MIDTRANS_CLIENT_KEY,
} = require('../config/midtrans');
const db = require('../config/database');

/**
 * POST /api/payment/create-token
 * Generate Snap token untuk pembayaran
 * 
 * Request body:
 * {
 *   booking_id: number,
 *   amount: number,
 *   customer_name: string,
 *   customer_email: string,
 *   customer_phone: string
 * }
 */
router.post('/create-token', async (req, res) => {
  try {
    const { booking_id, amount, customer_name, customer_email, customer_phone } = req.body;

    // Validasi input
    if (!booking_id || !amount || !customer_name || !customer_email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Generate order ID yang unik
    const orderId = `TRAVEL-${booking_id}-${Date.now()}`;

    // Parameter untuk Midtrans Snap
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: customer_name,
        email: customer_email,
        phone: customer_phone || '',
      },
      item_details: [
        {
          id: `BOOKING-${booking_id}`,
          price: amount,
          quantity: 1,
          name: `Travel Booking #${booking_id}`,
        },
      ],
      callbacks: {
        finish: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`,
        error: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/error`,
        pending: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/pending`,
      },
    };

    // Create transaction via Midtrans
    const result = await createTransaction(parameter);

    if (result.success) {
      // Simpan order_id ke database untuk tracking
      const query = `
        UPDATE bookings 
        SET payment_order_id = ?, payment_status = 'pending', updated_at = NOW()
        WHERE id = ?
      `;
      await db.query(query, [orderId, booking_id]);

      res.json({
        success: true,
        token: result.token,
        redirect_url: result.redirect_url,
        order_id: orderId,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message || 'Failed to create payment token',
      });
    }
  } catch (error) {
    console.error('Error in /create-token:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/payment/notification
 * Webhook dari Midtrans untuk update status pembayaran
 * 
 * Akan dipanggil otomatis oleh Midtrans saat status pembayaran berubah
 */
router.post('/notification', async (req, res) => {
  try {
    const notification = req.body;

    // Verifikasi signature untuk keamanan
    const isValid = verifySignature(notification);
    if (!isValid) {
      return res.status(403).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    const {
      order_id,
      transaction_status,
      fraud_status,
      payment_type,
      gross_amount,
    } = notification;

    console.log('Payment notification received:', {
      order_id,
      transaction_status,
      fraud_status,
    });

    // Map Midtrans status ke status internal
    let paymentStatus = 'pending';
    if (transaction_status === 'capture') {
      paymentStatus = fraud_status === 'accept' ? 'success' : 'pending';
    } else if (transaction_status === 'settlement') {
      paymentStatus = 'success';
    } else if (
      transaction_status === 'cancel' ||
      transaction_status === 'deny' ||
      transaction_status === 'expire'
    ) {
      paymentStatus = 'failed';
    } else if (transaction_status === 'pending') {
      paymentStatus = 'pending';
    }

    // Update status di database
    const query = `
      UPDATE bookings 
      SET 
        payment_status = ?,
        payment_method = ?,
        payment_amount = ?,
        updated_at = NOW()
      WHERE payment_order_id = ?
    `;
    await db.query(query, [paymentStatus, payment_type, gross_amount, order_id]);

    res.json({
      success: true,
      message: 'Notification processed',
    });
  } catch (error) {
    console.error('Error in /notification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/payment/status/:orderId
 * Cek status pembayaran manual
 */
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Cek status dari Midtrans
    const result = await checkTransactionStatus(orderId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message || 'Failed to check status',
      });
    }
  } catch (error) {
    console.error('Error in /status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/payment/config
 * Get Midtrans client key untuk frontend
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    client_key: MIDTRANS_CLIENT_KEY,
  });
});

/**
 * GET /api/payment/test
 * Test endpoint untuk verifikasi koneksi
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Payment routes are working',
    environment: process.env.MIDTRANS_ENVIRONMENT || 'sandbox',
  });
});

module.exports = router;
