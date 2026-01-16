/**
 * DRIVER CHAT/INBOX ROUTES
 * Endpoints for driver to view and manage conversations with customers
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /api/driver/inbox/:driverId
 * Get list of all conversations/chat rooms for driver
 * Returns active chats with unread count and last message
 */
router.get('/inbox/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required'
      });
    }

    // Get all chat rooms for this driver with booking details
    const query = `
      SELECT 
        cr.id as chat_room_id,
        cr.booking_id,
        cr.booking_type,
        cr.customer_id,
        cr.driver_id,
        cr.last_message_text,
        cr.last_message_at,
        cr.last_message_sender_type,
        cr.driver_unread_count,
        cr.status as chat_status,
        
        -- Customer info
        u.phone as customer_phone,
        u.username as customer_name,
        
        -- Booking info from independent_bookings
        ib.pickup_address,
        ib.dropoff_address,
        ib.status as booking_status,
        ib.booking_date,
        ib.booking_time,
        ib.vehicle_type
        
      FROM chat_rooms cr
      LEFT JOIN users u ON cr.customer_id = u.id
      LEFT JOIN independent_bookings ib ON cr.booking_id = ib.id AND cr.booking_type IN ('delivery', 'ride', 'food', 'cargo')
      WHERE cr.driver_id = ?
        AND cr.status = 'active'
      ORDER BY cr.last_message_at DESC
      LIMIT 50
    `;

    const [conversations] = await db.query(query, [driverId]);

    // Calculate total unread count
    const totalUnread = conversations.reduce((sum, conv) => sum + (conv.driver_unread_count || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        conversations,
        total_unread: totalUnread,
        total_conversations: conversations.length
      }
    });

  } catch (error) {
    console.error('Error fetching driver inbox:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching inbox',
      error: error.message
    });
  }
});

/**
 * GET /api/driver/chat/:bookingId/messages
 * Get all messages for a specific booking/conversation
 */
router.get('/chat/:bookingId/messages', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { driver_id } = req.query;

    if (!bookingId || !driver_id) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and driver ID are required'
      });
    }

    // Verify driver has access to this booking
    const [bookingCheck] = await db.query(
      'SELECT id FROM independent_bookings WHERE id = ? AND driver_id = ?',
      [bookingId, driver_id]
    );

    if (bookingCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Booking not found or not assigned to you.'
      });
    }

    // Get all messages for this booking
    const query = `
      SELECT 
        id,
        booking_id,
        booking_type,
        sender_id,
        sender_type,
        sender_name,
        message_type,
        message_text,
        image_url,
        latitude,
        longitude,
        is_read,
        read_at,
        created_at
      FROM messages
      WHERE booking_id = ?
      ORDER BY created_at ASC
    `;

    const [messages] = await db.query(query, [bookingId]);

    // Mark all unread messages as read by driver
    await db.query(
      `UPDATE messages 
       SET is_read = TRUE, read_at = NOW() 
       WHERE booking_id = ? 
         AND sender_type = 'customer' 
         AND is_read = FALSE`,
      [bookingId]
    );

    // Update chat room unread count
    await db.query(
      `UPDATE chat_rooms 
       SET driver_unread_count = 0 
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
    console.error('Error fetching chat messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching messages',
      error: error.message
    });
  }
});

/**
 * POST /api/driver/chat/:bookingId/send
 * Send a message from driver to customer
 */
router.post('/chat/:bookingId/send', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { driver_id, message_text, message_type = 'text', image_url = null } = req.body;

    if (!bookingId || !driver_id || !message_text) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID, driver ID, and message text are required'
      });
    }

    // Get driver info
    const [driverInfo] = await db.query(
      'SELECT full_name FROM independent_drivers WHERE id = ?',
      [driver_id]
    );

    if (driverInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driverName = driverInfo[0].full_name || 'Driver';

    // Get booking type
    const [bookingInfo] = await db.query(
      'SELECT vehicle_type FROM independent_bookings WHERE id = ?',
      [bookingId]
    );

    if (bookingInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Determine booking type from vehicle_type
    const vehicleType = bookingInfo[0].vehicle_type;
    let bookingType = 'delivery';
    if (vehicleType === 'motor' || vehicleType === 'mobil') {
      bookingType = 'ride';
    }

    // Insert message
    const [result] = await db.query(
      `INSERT INTO messages 
       (booking_id, booking_type, sender_id, sender_type, sender_name, 
        message_type, message_text, image_url, is_read) 
       VALUES (?, ?, ?, 'driver', ?, ?, ?, ?, FALSE)`,
      [bookingId, bookingType, driver_id, driverName, message_type, message_text, image_url]
    );

    // Update chat room last message
    await db.query(
      `UPDATE chat_rooms 
       SET last_message_text = ?,
           last_message_at = NOW(),
           last_message_sender_type = 'driver',
           customer_unread_count = customer_unread_count + 1
       WHERE booking_id = ?`,
      [message_text, bookingId]
    );

    // Get customer FCM token for notification
    const [chatRoom] = await db.query(
      'SELECT customer_id FROM chat_rooms WHERE booking_id = ?',
      [bookingId]
    );

    if (chatRoom.length > 0) {
      const customerId = chatRoom[0].customer_id;
      
      // Get customer FCM token
      const [customerTokens] = await db.query(
        'SELECT fcm_token FROM customers WHERE id = ? AND fcm_token IS NOT NULL',
        [customerId]
      );

      // Send push notification to customer
      if (customerTokens.length > 0) {
        const fcmToken = customerTokens[0].fcm_token;
        const admin = require('firebase-admin');
        
        try {
          const messagePayload = {
            notification: {
              title: `Pesan dari ${driverName}`,
              body: message_type === 'image' ? '📷 Mengirim foto' : message_text,
            },
            data: {
              type: 'new_message',
              booking_id: bookingId.toString(),
              sender_type: 'driver',
              sender_name: driverName,
              message_type: message_type,
            },
            token: fcmToken
          };

          await admin.messaging().send(messagePayload);
          console.log('✅ Push notification sent to customer');
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
      message: 'Server error sending message',
      error: error.message
    });
  }
});

/**
 * GET /api/driver/inbox/unread-count/:driverId
 * Get total unread message count for driver (for badge display)
 */
router.get('/inbox/unread-count/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;

    const [result] = await db.query(
      `SELECT SUM(driver_unread_count) as total_unread 
       FROM chat_rooms 
       WHERE driver_id = ? AND status = 'active'`,
      [driverId]
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
      message: 'Server error fetching unread count',
      error: error.message
    });
  }
});

module.exports = router;
