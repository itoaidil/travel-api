const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// Ensure customer_notifications table exists (non-blocking)
async function ensureCustomerNotifTable(db) {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS customer_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        notification_type VARCHAR(64) NOT NULL DEFAULT 'system',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        booking_id INT DEFAULT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        read_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_unread (user_id, is_read),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (_) { /* table already exists */ }
}

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

// ─── Customer notification bell endpoints ────────────────────────────────────

/**
 * GET /api/notifications/:userId
 * List customer notifications from DB (for bell screen)
 */
router.get('/:userId', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'DB unavailable' });

  const userId = parseInt(req.params.userId);
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const unreadOnly = req.query.unreadOnly === 'true';

  try {
    await ensureCustomerNotifTable(db);
    const whereExtra = unreadOnly ? ' AND is_read = 0' : '';
    const [rows] = await db.query(
      `SELECT id, user_id, notification_type, title, message, booking_id, is_read, read_at, created_at
       FROM customer_notifications
       WHERE user_id = ?${whereExtra}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    return res.json({ success: true, notifications: rows });
  } catch (err) {
    console.error('❌ getNotifications error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/notifications/:userId/unread-count
 */
router.get('/:userId/unread-count', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, count: 0 });

  const userId = parseInt(req.params.userId);
  try {
    await ensureCustomerNotifTable(db);
    const [[row]] = await db.query(
      'SELECT COUNT(*) AS cnt FROM customer_notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return res.json({ success: true, count: row.cnt });
  } catch (err) {
    return res.json({ success: true, count: 0 });
  }
});

/**
 * PUT /api/notifications/:notificationId/read
 */
router.put('/:notificationId/read', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false });

  try {
    await db.query(
      'UPDATE customer_notifications SET is_read = 1, read_at = NOW() WHERE id = ?',
      [parseInt(req.params.notificationId)]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/notifications/:userId/read-all
 */
router.put('/:userId/read-all', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false });

  try {
    await db.query(
      'UPDATE customer_notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
      [parseInt(req.params.userId)]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/notifications/broadcast-promo
 * Send a promo / info notification to all customers with FCM token.
 * Body: { title, message, secret }
 * secret must match BROADCAST_SECRET env var (default: "hantar_admin")
 */
router.post('/broadcast-promo', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'DB unavailable' });

  const { title, message, secret } = req.body;
  const expectedSecret = process.env.BROADCAST_SECRET || 'hantar_admin';

  if (secret !== expectedSecret) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  if (!title || !message) {
    return res.status(400).json({ success: false, message: 'title and message are required' });
  }

  try {
    await ensureCustomerNotifTable(db);

    // Get all customers
    const [customers] = await db.query(
      'SELECT id, fcm_token FROM customers WHERE id IS NOT NULL'
    );

    let pushSent = 0;
    let dbInserted = 0;
    const invalidTokens = [];

    for (const customer of customers) {
      // Insert into notification bell DB
      try {
        await db.query(
          `INSERT INTO customer_notifications (user_id, notification_type, title, message, created_at)
           VALUES (?, 'promo', ?, ?, NOW())`,
          [customer.id, title, message]
        );
        dbInserted++;
      } catch (_) {}

      // Send FCM push if token exists
      if (customer.fcm_token) {
        try {
          await admin.messaging().send({
            token: customer.fcm_token,
            data: {
              type: 'promo',
              title,
              body: message,
              id: String(Date.now()),
            },
            android: {
              priority: 'high',
              notification: { channelId: 'customer_channel', sound: 'default' },
            },
          });
          pushSent++;
        } catch (err) {
          const code = err?.errorInfo?.code || err?.code || '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(customer.fcm_token);
          }
        }
      }
    }

    // Clean up stale tokens
    if (invalidTokens.length) {
      const placeholders = invalidTokens.map(() => '?').join(',');
      await db.query(
        `UPDATE customers SET fcm_token = NULL WHERE fcm_token IN (${placeholders})`,
        invalidTokens
      ).catch(() => {});
    }

    console.log(`📢 Broadcast promo: dbInserted=${dbInserted}, pushSent=${pushSent}, customers=${customers.length}`);
    return res.json({ success: true, customers: customers.length, pushSent, dbInserted });

  } catch (err) {
    console.error('❌ broadcast-promo error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
