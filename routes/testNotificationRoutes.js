const express = require('express');
const router = express.Router();
const db = require('../config/database');
const admin = require('firebase-admin');

/**
 * POST /api/test/nearby-drivers
 * Test nearby drivers query
 */
router.post('/nearby-drivers', async (req, res) => {
  try {
    const { pickup_lat, pickup_lng, vehicle_type } = req.body;
    
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
      pickup_lat, pickup_lng, pickup_lat,
      vehicle_type,
      pickup_lat, radiusDegrees, pickup_lat, radiusDegrees,
      pickup_lng, radiusDegrees, pickup_lng, radiusDegrees
    ]);

    res.json({
      success: true,
      count: nearbyDrivers.length,
      drivers: nearbyDrivers
    });
  } catch (error) {
    console.error('Test query error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * POST /api/test/send-fcm
 * Test send FCM notification directly
 */
router.post('/send-fcm', async (req, res) => {
  try {
    const { fcm_token, booking_id } = req.body;
    
    const message = {
      token: fcm_token,
      notification: {
        title: '🚚 Test Booking Baru!',
        body: `Test booking ID ${booking_id}`
      },
      data: {
        booking_id: String(booking_id),
        type: 'new_booking'
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'booking_notifications',
          sound: 'default',
          priority: 'high'
        }
      }
    };

    const response = await admin.messaging().send(message);
    
    res.json({
      success: true,
      message: 'FCM sent successfully',
      fcm_response: response
    });
  } catch (error) {
    console.error('FCM send error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      stack: error.stack
    });
  }
});

module.exports = router;
