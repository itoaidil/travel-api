const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * POST /api/broadcast/respond
 * Driver accept or reject a booking offer
 */
router.post('/respond', async (req, res) => {
  const { offer_id, driver_id, response, reason } = req.body;

  // Validation
  if (!offer_id || !driver_id || !response) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: offer_id, driver_id, response'
    });
  }

  if (!['accepted', 'rejected'].includes(response)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid response. Must be "accepted" or "rejected"'
    });
  }

  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    // 1. Get offer details
    const [offers] = await connection.query(
      `SELECT bdo.*, ib.booking_id, ib.status as booking_status, ib.pickup_location, ib.dropoff_location
       FROM booking_driver_offers bdo
       JOIN independent_bookings ib ON bdo.booking_id = ib.booking_id
       WHERE bdo.offer_id = ? AND bdo.driver_id = ?`,
      [offer_id, driver_id]
    );

    if (offers.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Offer not found or not assigned to this driver'
      });
    }

    const offer = offers[0];
    const booking_id = offer.booking_id;

    // 2. Check if booking is still pending
    if (offer.booking_status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Booking already ${offer.booking_status}. Cannot respond to offer.`
      });
    }

    // 3. Check if offer is still active
    if (offer.status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Offer already ${offer.status}. Cannot respond.`
      });
    }

    if (response === 'accepted') {
      // ACCEPT: Assign booking to driver
      
      // Update offer status
      await connection.query(
        'UPDATE booking_driver_offers SET status = ?, responded_at = NOW() WHERE offer_id = ?',
        ['accepted', offer_id]
      );

      // Assign booking to driver
      await connection.query(
        `UPDATE independent_bookings 
         SET status = 'assigned', 
             driver_id = ?,
             assigned_at = NOW()
         WHERE booking_id = ?`,
        [driver_id, booking_id]
      );

      // Reject all other pending offers for this booking
      await connection.query(
        `UPDATE booking_driver_offers 
         SET status = 'expired', responded_at = NOW()
         WHERE booking_id = ? AND offer_id != ? AND status = 'pending'`,
        [booking_id, offer_id]
      );

      // Record in broadcast history
      await connection.query(
        `INSERT INTO driver_broadcast_history 
         (booking_id, driver_id, wave_number, broadcast_at, response, responded_at)
         VALUES (?, ?, ?, NOW(), 'accepted', NOW())`,
        [booking_id, driver_id, offer.wave_number]
      );

      await connection.commit();

      res.json({
        success: true,
        status: 'accepted',
        booking_id: booking_id,
        driver_id: driver_id,
        message: 'Penawaran diterima! Booking assigned to you.',
        booking_details: {
          pickup: offer.pickup_location,
          dropoff: offer.dropoff_location
        }
      });

    } else {
      // REJECT: Record rejection reason
      
      if (!reason || reason.trim() === '') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required'
        });
      }

      // Update offer status
      await connection.query(
        'UPDATE booking_driver_offers SET status = ?, responded_at = NOW() WHERE offer_id = ?',
        ['rejected', offer_id]
      );

      // Record rejection in driver_order_rejections
      await connection.query(
        `INSERT INTO driver_order_rejections 
         (driver_id, booking_id, reason, rejected_at)
         VALUES (?, ?, ?, NOW())`,
        [driver_id, booking_id, reason]
      );

      // Record in broadcast history
      await connection.query(
        `INSERT INTO driver_broadcast_history 
         (booking_id, driver_id, wave_number, broadcast_at, response, responded_at, rejection_reason)
         VALUES (?, ?, ?, NOW(), 'rejected', NOW(), ?)`,
        [booking_id, driver_id, offer.wave_number, reason]
      );

      // Update driver stats if optional analytics column exists.
      // Do not fail reject flow when legacy schema lacks total_rejections.
      try {
        await connection.query(
          `UPDATE independent_drivers
           SET total_rejections = COALESCE(total_rejections, 0) + 1,
               updated_at = NOW()
           WHERE id = ?`,
          [driver_id]
        );
      } catch (error) {
        if (error && error.code === 'ER_BAD_FIELD_ERROR') {
          console.warn('⚠️ Skip total_rejections update: column not found in independent_drivers');
        } else {
          throw error;
        }
      }

      await connection.commit();

      res.json({
        success: true,
        status: 'rejected',
        booking_id: booking_id,
        driver_id: driver_id,
        message: 'Penawaran ditolak.',
        reason: reason
      });
    }

  } catch (error) {
    await connection.rollback();
    console.error('Error responding to broadcast:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing response',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

module.exports = router;
