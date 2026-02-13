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
      'SELECT id, status FROM independent_drivers WHERE id = ?',
      [driver_id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = drivers[0];

    // Only accept location updates from active drivers
    if (driver.status !== 'active' && driver.status !== 'offline') {
      return res.status(400).json({
        success: false,
        message: 'Driver account is not active'
      });
    }

    // Insert location record
    await db.query(
      `INSERT INTO driver_locations 
       (driver_id, latitude, longitude, accuracy, speed, heading, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         latitude = VALUES(latitude),
         longitude = VALUES(longitude),
         accuracy = VALUES(accuracy),
         speed = VALUES(speed),
         heading = VALUES(heading),
         is_active = 1,
         updated_at = NOW()`,
      [driver_id, latitude, longitude, accuracy || null, speed || null, heading || null]
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
        dl.created_at,
        dl.is_active,
        d.status,
        d.full_name
       FROM driver_locations dl
       JOIN independent_drivers d ON dl.driver_id = d.id
       WHERE dl.driver_id = ?
       ORDER BY dl.created_at DESC
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

/**
 * GET /api/driver-location/status/:driver_id
 * Check if driver is online/active (heartbeat status)
 */
router.get('/status/:driver_id', async (req, res) => {
  const { driver_id } = req.params;
  const { timeout_minutes = 15 } = req.query; // Driver offline if no heartbeat in X minutes

  try {
    const [locations] = await db.query(
      `SELECT 
        dl.driver_id,
        dl.is_active,
        dl.latitude,
        dl.longitude,
        dl.created_at,
        d.full_name,
        d.status as driver_status,
        TIMESTAMPDIFF(MINUTE, dl.created_at, NOW()) as minutes_since_update
       FROM driver_locations dl
       JOIN independent_drivers d ON dl.driver_id = d.id
       WHERE dl.driver_id = ?
       ORDER BY dl.created_at DESC
       LIMIT 1`,
      [driver_id]
    );

    if (locations.length === 0) {
      // No location data, check driver exists
      const [drivers] = await db.query(
        'SELECT id, full_name, status FROM independent_drivers WHERE id = ?',
        [driver_id]
      );

      if (drivers.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Driver not found'
        });
      }

      return res.json({
        success: true,
        driver_id: driver_id,
        driver_name: drivers[0].full_name,
        driver_status: drivers[0].status,
        online: false,
        reason: 'No location data sent',
        last_heartbeat: null
      });
    }

    const location = locations[0];
    const timeout = parseInt(timeout_minutes);
    const minutes_since = location.minutes_since_update;
    const is_online = minutes_since < timeout && location.is_active === 1;

    return res.json({
      success: true,
      driver_id: driver_id,
      driver_name: location.full_name,
      driver_status: location.driver_status,
      online: is_online,
      is_active: location.is_active === 1,
      last_heartbeat: location.created_at,
      minutes_since_update: minutes_since,
      timeout_minutes: timeout,
      last_location: {
        latitude: location.latitude,
        longitude: location.longitude
      }
    });

  } catch (error) {
    console.error('Error checking driver status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error checking status',
      error: error.message
    });
  }
});

/**
 * GET /api/driver-location/status/all
 * Check status of all drivers (online/offline)
 */
router.get('/status-all', async (req, res) => {
  const { timeout_minutes = 15 } = req.query;

  try {
    const timeout = parseInt(timeout_minutes);

    const [drivers] = await db.query(
      `SELECT 
        d.id,
        d.full_name,
        d.status,
        COALESCE(dl.is_active, 0) as is_active,
        dl.created_at as last_heartbeat,
        COALESCE(TIMESTAMPDIFF(MINUTE, dl.created_at, NOW()), -1) as minutes_since_update,
        dl.latitude,
        dl.longitude
       FROM independent_drivers d
       LEFT JOIN driver_locations dl ON d.id = dl.driver_id
       AND dl.created_at = (
         SELECT MAX(created_at) FROM driver_locations WHERE driver_id = d.id
       )
       ORDER BY d.id DESC`
    );

    const driverStatus = drivers.map(driver => ({
      driver_id: driver.id,
      name: driver.full_name,
      status: driver.status,
      online: driver.is_active === 1 && (driver.minutes_since_update === -1 || driver.minutes_since_update < timeout),
      last_heartbeat: driver.last_heartbeat,
      minutes_since_update: driver.minutes_since_update === -1 ? 'never' : driver.minutes_since_update,
      last_location: driver.latitude ? { lat: driver.latitude, lng: driver.longitude } : null
    }));

    return res.json({
      success: true,
      total_drivers: driverStatus.length,
      online_count: driverStatus.filter(d => d.online).length,
      offline_count: driverStatus.filter(d => !d.online).length,
      timeout_minutes: timeout,
      drivers: driverStatus
    });

  } catch (error) {
    console.error('Error checking all drivers status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error checking drivers status',
      error: error.message
    });
  }
});

module.exports = router;
