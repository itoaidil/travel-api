const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * POST /api/driver/online-status
 * Toggle driver online/offline status
 */
router.post('/online-status', async (req, res) => {
  const { driver_id, is_online } = req.body;

  if (!driver_id || is_online === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: driver_id, is_online'
    });
  }

  try {
    // Map is_online boolean to status enum (active/offline)
    const newStatus = is_online ? 'active' : 'offline';
    
    // Update driver status
    const [result] = await db.query(
      `UPDATE independent_drivers 
       SET status = ?, 
           updated_at = NOW()
       WHERE id = ?`,
      [newStatus, driver_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    console.log(`✅ Driver ${driver_id} status updated to: ${newStatus}`);

    res.json({
      success: true,
      driver_id: driver_id,
      is_online: is_online,
      status: newStatus,
      message: is_online ? 'Driver is now online' : 'Driver is now offline'
    });

  } catch (error) {
    console.error('Error updating driver status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating status',
      error: error.message
    });
  }
});

/**
 * POST /api/driver/register-fcm
 * Register FCM token for push notifications
 */
router.post('/register-fcm', async (req, res) => {
  const { driver_id, fcm_token, device_type } = req.body;

  if (!driver_id || !fcm_token) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: driver_id, fcm_token'
    });
  }

  try {
    // Check if driver exists
    const [drivers] = await db.query(
      'SELECT id, status FROM independent_drivers WHERE id = ?',
      [driver_id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Update FCM token and auto-set driver to active status
    await db.query(
      `UPDATE independent_drivers 
       SET fcm_token = ?, 
           status = 'active',
           updated_at = NOW()
       WHERE id = ?`,
      [fcm_token, driver_id]
    );
    
    console.log(`✅ FCM token registered for driver ${driver_id}, status set to active`);

    res.json({
      success: true,
      driver_id: driver_id,
      message: 'FCM token registered successfully'
    });

  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Server error registering token',
      error: error.message
    });
  }
});

/**
 * GET /api/driver/profile
 * Get driver profile with stats
 */
router.get('/profile', async (req, res) => {
  const { driver_id } = req.query;

  if (!driver_id) {
    return res.status(400).json({
      success: false,
      message: 'Missing required parameter: driver_id'
    });
  }

  try {
    const [drivers] = await db.query(
      `SELECT 
        id as driver_id,
        full_name,
        phone,
        email,
        nik,
        vehicle_type,
        vehicle_plate,
        vehicle_color,
        service_type_allowed,
        status,
        rating,
        total_trips,
        total_earnings,
        created_at,
        last_online_at
       FROM independent_drivers 
       WHERE id = ?`,
      [driver_id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.json({
      success: true,
      driver: drivers[0]
    });

  } catch (error) {
    console.error('Error fetching driver profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching profile',
      error: error.message
    });
  }
});

/**
 * POST /api/driver/change-password
 * Change driver password
 */
router.post('/change-password', async (req, res) => {
  const { driver_id, phone, old_password, new_password } = req.body;

  if (!driver_id || !phone || !old_password || !new_password) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
  }

  if (new_password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters'
    });
  }

  try {
    const bcrypt = require('bcryptjs');

    // Get user by phone
    const [users] = await db.query(
      `SELECT u.id, u.password 
       FROM users u
       INNER JOIN independent_drivers d ON u.id = d.user_id
       WHERE u.phone = ? AND d.id = ?`,
      [phone, driver_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const user = users[0];

    // Verify old password
    const validPassword = await bcrypt.compare(old_password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Password lama tidak valid'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await db.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, user.id]
    );

    res.json({
      success: true,
      message: 'Password berhasil diubah'
    });

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Server error changing password',
      error: error.message
    });
  }
});

/**
 * Get driver dashboard statistics
 * GET /api/driver/dashboard/:driver_id
 * 
 * Returns:
 * - Total earnings (lifetime)
 * - Today's earnings
 * - Completed trips (lifetime)
 * - Completed trips today
 * - Pending bookings
 * - Accepted bookings (in progress)
 */
router.get('/dashboard/:driver_id', async (req, res) => {
  try {
    const { driver_id } = req.params;

    console.log(`📊 Fetching dashboard for driver ${driver_id}`);

    // Get total earnings (lifetime)
    const [totalEarnings] = await db.query(
      `SELECT 
        COALESCE(SUM(driver_earnings), 0) as total_earnings,
        COUNT(*) as total_trips
      FROM independent_bookings 
      WHERE driver_id = ? 
        AND booking_status = 'completed'
        AND driver_earnings IS NOT NULL`,
      [driver_id]
    );

    // Get today's earnings
    const [todayEarnings] = await db.query(
      `SELECT 
        COALESCE(SUM(driver_earnings), 0) as today_earnings,
        COUNT(*) as today_trips
      FROM independent_bookings 
      WHERE driver_id = ? 
        AND booking_status = 'completed'
        AND DATE(completed_at) = CURDATE()
        AND driver_earnings IS NOT NULL`,
      [driver_id]
    );

    // Get active bookings count
    const [activeBookings] = await db.query(
      `SELECT 
        COUNT(*) as accepted_count
      FROM independent_bookings 
      WHERE driver_id = ? 
        AND booking_status IN ('accepted', 'in_progress')`,
      [driver_id]
    );

    // Get recent completed bookings (last 5)
    const [recentTrips] = await db.query(
      `SELECT 
        id,
        booking_code,
        pickup_address,
        dropoff_address,
        distance_km,
        total_price,
        driver_earnings,
        completed_at,
        customer_rating
      FROM independent_bookings 
      WHERE driver_id = ? 
        AND booking_status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 5`,
      [driver_id]
    );

    const dashboard = {
      total_earnings: parseFloat(totalEarnings[0].total_earnings) || 0,
      total_trips: parseInt(totalEarnings[0].total_trips) || 0,
      today_earnings: parseFloat(todayEarnings[0].today_earnings) || 0,
      today_trips: parseInt(todayEarnings[0].today_trips) || 0,
      active_bookings: parseInt(activeBookings[0].accepted_count) || 0,
      recent_trips: recentTrips
    };

    console.log(`✅ Dashboard data:`, dashboard);

    return res.json({
      success: true,
      data: dashboard
    });

  } catch (error) {
    console.error('❌ Error fetching driver dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard',
      error: error.message
    });
  }
});

/**
 * Get driver booking history with earnings
 * GET /api/driver/history/:driver_id
 * 
 * Query params:
 * - status: filter by booking_status (optional)
 * - limit: number of records (default 20)
 * - offset: pagination offset (default 0)
 */
router.get('/history/:driver_id', async (req, res) => {
  try {
    const { driver_id } = req.params;
    const { status, limit = 20, offset = 0 } = req.query;

    console.log(`📜 Fetching history for driver ${driver_id}`);

    let query = `
      SELECT 
        id,
        booking_code,
        booking_type,
        customer_name,
        customer_phone,
        pickup_address,
        dropoff_address,
        pickup_lat,
        pickup_lng,
        dropoff_lat,
        dropoff_lng,
        distance_km,
        booking_status,
        payment_status,
        payment_method,
        total_price,
        driver_earnings,
        platform_fee,
        customer_rating,
        customer_review,
        accepted_at,
        started_at,
        completed_at,
        created_at
      FROM independent_bookings 
      WHERE driver_id = ?
    `;

    const params = [driver_id];

    if (status) {
      query += ' AND booking_status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [bookings] = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM independent_bookings WHERE driver_id = ?';
    const countParams = [driver_id];
    
    if (status) {
      countQuery += ' AND booking_status = ?';
      countParams.push(status);
    }

    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    console.log(`✅ Found ${bookings.length} bookings (total: ${total})`);

    return res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: (parseInt(offset) + bookings.length) < total
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching driver history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch history',
      error: error.message
    });
  }
});

/**
 * POST /api/driver/test-notification/:driver_id
 * Test push notification untuk driver dengan booking tertentu
 */
router.post('/test-notification/:driver_id', async (req, res) => {
  const { driver_id } = req.params;
  const { booking_id } = req.body;

  try {
    // Get driver FCM token
    const [drivers] = await db.query(
      'SELECT fcm_token, full_name FROM independent_drivers WHERE id = ?',
      [driver_id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = drivers[0];
    if (!driver.fcm_token) {
      return res.status(400).json({
        success: false,
        message: 'Driver does not have FCM token registered'
      });
    }

    // Get booking data
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

    // Import notification service
    const { sendNewBookingNotification } = require('../services/notificationService');

    // Send notification (with driver_id to save to database)
    const result = await sendNewBookingNotification(
      driver.fcm_token, 
      {
        booking_id: booking.id,
        customer_name: booking.customer_name || 'Customer',
        pickup_address: booking.pickup_address,
        dropoff_address: booking.dropoff_address,
        total_price: booking.total_price,
        vehicle_type: booking.vehicle_type,
        item_type: booking.item_type || 'paket',
        distance_km: booking.distance_km || 0
      },
      driver_id  // Pass driver_id to save notification to database
    );

    return res.json({
      success: true,
      message: 'Test notification sent',
      driver: {
        id: driver_id,
        name: driver.full_name,
        has_fcm_token: true
      },
      booking: {
        id: booking.id,
        status: booking.booking_status
      },
      notification_result: result
    });

  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    });
  }
});

module.exports = router;
