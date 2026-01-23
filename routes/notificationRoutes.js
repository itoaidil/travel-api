const express = require('express');
const router = express.Router();

/**
 * POST /api/notifications/register-token
 * Register FCM token for customer
 */
router.post('/register-token', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const { customer_id, fcm_token } = req.body;

    if (!customer_id || !fcm_token) {
      return res.status(400).json({
        success: false,
        message: 'customer_id and fcm_token are required'
      });
    }

    // Update customer's FCM token
    await db.query(
      'UPDATE customers SET fcm_token = ?, updated_at = NOW() WHERE id = ?',
      [fcm_token, customer_id]
    );

    console.log(`✅ FCM token registered for customer ${customer_id}`);

    return res.json({
      success: true,
      message: 'FCM token registered successfully'
    });

  } catch (error) {
    console.error('❌ Error registering FCM token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register FCM token',
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/unregister-token
 * Unregister FCM token (on logout)
 */
router.post('/unregister-token', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const { customer_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: 'customer_id is required'
      });
    }

    // Clear customer's FCM token
    await db.query(
      'UPDATE customers SET fcm_token = NULL, updated_at = NOW() WHERE id = ?',
      [customer_id]
    );

    console.log(`✅ FCM token unregistered for customer ${customer_id}`);

    return res.json({
      success: true,
      message: 'FCM token unregistered successfully'
    });

  } catch (error) {
    console.error('❌ Error unregistering FCM token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unregister FCM token',
      error: error.message
    });
  }
});

module.exports = router;
