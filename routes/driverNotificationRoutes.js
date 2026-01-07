const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /api/driver/notifications/:driver_id
 * Get all notifications for a driver
 */
router.get('/:driver_id', async (req, res) => {
  const { driver_id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const [notifications] = await db.query(
      `SELECT * FROM driver_notifications 
       WHERE driver_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [driver_id, parseInt(limit), parseInt(offset)]
    );

    // Get unread count
    const [countResult] = await db.query(
      'SELECT COUNT(*) as unread_count FROM driver_notifications WHERE driver_id = ? AND is_read = 0',
      [driver_id]
    );

    return res.json({
      success: true,
      data: {
        notifications,
        unread_count: countResult[0].unread_count
      }
    });

  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

/**
 * POST /api/driver/notifications/:driver_id/mark-read
 * Mark notification(s) as read
 */
router.post('/:driver_id/mark-read', async (req, res) => {
  const { driver_id } = req.params;
  const { notification_id, mark_all } = req.body;

  try {
    if (mark_all) {
      // Mark all notifications as read
      await db.query(
        `UPDATE driver_notifications 
         SET is_read = 1, read_at = NOW() 
         WHERE driver_id = ? AND is_read = 0`,
        [driver_id]
      );

      return res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } else if (notification_id) {
      // Mark specific notification as read
      await db.query(
        `UPDATE driver_notifications 
         SET is_read = 1, read_at = NOW() 
         WHERE id = ? AND driver_id = ?`,
        [notification_id, driver_id]
      );

      return res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either notification_id or mark_all must be provided'
      });
    }

  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

/**
 * DELETE /api/driver/notifications/:notification_id
 * Delete a specific notification
 */
router.delete('/:notification_id', async (req, res) => {
  const { notification_id } = req.params;

  try {
    const [result] = await db.query(
      'DELETE FROM driver_notifications WHERE id = ?',
      [notification_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.json({
      success: true,
      message: 'Notification deleted'
    });

  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

module.exports = router;
