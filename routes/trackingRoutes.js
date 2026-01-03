const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * POST /api/driver-location/heartbeat
 * Receive GPS location updates from driver app
 */
router.post('/heartbeat', async (req, res) => {
  const { driver_id, latitude, longitude, accuracy, speed, heading } = req.body;

  // Validation
  if (!driver_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: driver_id, latitude, longitude'
    });
  }

  // Validate coordinates
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({
      success: false,
      message: 'Invalid coordinates'
    });
  }

  try {
    // Check if driver exists and is active
    const [drivers] = await db.query(
      'SELECT driver_id, is_online, is_active FROM independent_drivers WHERE driver_id = ?',
      [driver_id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = drivers[0];

    // Only accept location updates from online and active drivers
    if (!driver.is_online || !driver.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Driver is not online or not active'
      });
    }

    // Insert location record
    await db.query(
      `INSERT INTO driver_locations 
       (driver_id, latitude, longitude, accuracy, speed, heading, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [driver_id, latitude, longitude, accuracy || null, speed || null, heading || null]
    );

    // Update driver's last known location in independent_drivers table
    await db.query(
      `UPDATE independent_drivers 
       SET current_latitude = ?,
           current_longitude = ?,
           last_location_update = NOW()
       WHERE driver_id = ?`,
      [latitude, longitude, driver_id]
    );

    res.json({
      success: true,
      driver_id: driver_id,
      message: 'Location updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error saving location:', error);
    res.status(500).json({
      success: false,
      message: 'Server error saving location',
      error: error.message
    });
  }
});

/**
 * GET /api/driver-location/current/:driver_id
 * Get current location of a driver
 */
router.get('/current/:driver_id', async (req, res) => {
  const { driver_id } = req.params;

  try {
    const [locations] = await db.query(
      `SELECT 
        dl.latitude,
        dl.longitude,
        dl.accuracy,
        dl.speed,
        dl.heading,
        dl.timestamp,
        d.is_online,
        d.full_name
       FROM driver_locations dl
       JOIN independent_drivers d ON dl.driver_id = d.driver_id
       WHERE dl.driver_id = ?
       ORDER BY dl.timestamp DESC
       LIMIT 1`,
      [driver_id]
    );

    if (locations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No location data found for this driver'
      });
    }

    res.json({
      success: true,
      location: locations[0]
    });

  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching location',
      error: error.message
    });
  }
});

/**
 * GET /api/driver-location/history/:driver_id
 * Get location history of a driver
 */
router.get('/history/:driver_id', async (req, res) => {
  const { driver_id } = req.params;
  const { limit = 50, since } = req.query;

  try {
    let query = `
      SELECT latitude, longitude, accuracy, speed, heading, timestamp
      FROM driver_locations
      WHERE driver_id = ?
    `;
    const params = [driver_id];

    if (since) {
      query += ' AND timestamp > ?';
      params.push(since);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    const [locations] = await db.query(query, params);

    res.json({
      success: true,
      count: locations.length,
      locations: locations
    });

  } catch (error) {
    console.error('Error fetching location history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching history',
      error: error.message
    });
  }
});

module.exports = router;
