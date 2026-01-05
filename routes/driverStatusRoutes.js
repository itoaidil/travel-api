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
           last_online_at = IF(? = 'active', NOW(), last_online_at)
       WHERE id = ?`,
      [newStatus, newStatus, driver_id]
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
           device_type = ?,
           last_fcm_update = NOW(),
           status = 'active',
           last_online_at = NOW()
       WHERE id = ?`,
      [fcm_token, device_type || 'android', driver_id]
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

module.exports = router;
