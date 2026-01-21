/**
 * CUSTOMER CHAT ROUTES
 * Endpoints for customer to chat with driver
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /api/customer/chat/:bookingId/messages
 * Get all messages for a booking
 */
router.get('/chat/:bookingId/messages', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { customer_id } = req.query;

    if (!bookingId || !customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and customer ID are required'
      });
    }

    // Verify customer has access to this booking
    const [bookingCheck] = await db.query(
      'SELECT id FROM independent_bookings WHERE id = ? AND customer_id = ?',
      [bookingId, customer_id]
    );

    if (bookingCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get all messages
    const [messages] = await db.query(
      `SELECT 
        id, booking_id, booking_type, sender_id, sender_type, sender_name,
        message_type, message_text, image_url, is_read, created_at
      FROM messages
      WHERE booking_id = ?
      ORDER BY created_at ASC`,
      [bookingId]
    );

    // Mark messages from driver as read
    await db.query(
      `UPDATE messages 
       SET is_read = TRUE, read_at = NOW() 
       WHERE booking_id = ? AND sender_type = 'driver' AND is_read = FALSE`,
      [bookingId]
    );

    // Update chat room unread count
    await db.query(
      `UPDATE chat_rooms 
       SET customer_unread_count = 0 
       WHERE booking_id = ?`,
      [bookingId]
    );

    return res.status(200).json({
      success: true,
      data: {
        messages,
        total_messages: messages.length
      }
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * POST /api/customer/chat/:bookingId/send
 * Send a message from customer to driver
 */
router.post('/chat/:bookingId/send', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { customer_id, customer_name, message_text, message_type = 'text', image_url = null } = req.body;

    if (!bookingId || !customer_id || !message_text) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID, customer ID, and message text are required'
      });
    }

    // Get booking info including booking_type
    const [bookingInfo] = await db.query(
      'SELECT booking_type, vehicle_type, driver_id FROM independent_bookings WHERE id = ? AND customer_id = ?',
      [bookingId, customer_id]
    );

    if (bookingInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or access denied'
      });
    }

    const bookingType = bookingInfo[0].booking_type; // Use actual booking_type from DB
    const driverId = bookingInfo[0].driver_id;

    // Insert message
    const [result] = await db.query(
      `INSERT INTO messages 
       (booking_id, booking_type, sender_id, sender_type, sender_name, 
        message_type, message_text, image_url, is_read) 
       VALUES (?, ?, ?, 'customer', ?, ?, ?, ?, FALSE)`,
      [bookingId, bookingType, customer_id, customer_name, message_type, message_text, image_url]
    );

    // Update chat room last message
    await db.query(
      `UPDATE chat_rooms 
       SET last_message_text = ?,
           last_message_at = NOW(),
           last_message_sender_type = 'customer',
           driver_unread_count = driver_unread_count + 1
       WHERE booking_id = ?`,
      [message_text, bookingId]
    );

    // Send push notification to driver
    if (driverId) {
      const [driverInfo] = await db.query(
        'SELECT fcm_token FROM independent_drivers WHERE id = ? AND fcm_token IS NOT NULL',
        [driverId]
      );

      if (driverInfo.length > 0) {
        const fcmToken = driverInfo[0].fcm_token;
        const admin = require('firebase-admin');
        
        try {
          const messagePayload = {
            notification: {
              title: `Pesan dari ${customer_name}`,
              body: message_type === 'image' ? '📷 Mengirim foto' : message_text,
            },
            data: {
              type: 'new_message',
              booking_id: bookingId.toString(),
              sender_type: 'customer',
              sender_name: customer_name,
              message_type: message_type,
            },
            token: fcmToken
          };

          await admin.messaging().send(messagePayload);
          console.log('✅ Push notification sent to driver');
        } catch (notifError) {
          console.error('⚠️ Failed to send notification:', notifError.message);
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message_id: result.insertId,
        booking_id: bookingId,
        sent_at: new Date()
      }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * GET /api/customer/chat/unread-count/:customerId
 * Get total unread message count for customer
 */
router.get('/chat/unread-count/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    const [result] = await db.query(
      `SELECT SUM(customer_unread_count) as total_unread 
       FROM chat_rooms 
       WHERE customer_id = ? AND status = 'active'`,
      [customerId]
    );

    const totalUnread = result[0]?.total_unread || 0;

    return res.status(200).json({
      success: true,
      data: {
        total_unread: totalUnread
      }
    });

  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
