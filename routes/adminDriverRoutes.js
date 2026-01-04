const express = require('express');
const router = express.Router();

// Get driver statistics
router.get('/drivers-stats', async (req, res) => {
  try {
    const db = req.db;
    
    // Get counts by status
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN d.status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN d.status = 'approved' AND u.is_active = 1 THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN d.status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM independent_drivers d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE u.user_type = 'driver'
    `);
    
    res.json({
      success: true,
      stats: stats[0]
    });
  } catch (error) {
    console.error('Error loading stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load statistics',
      error: error.message
    });
  }
});

// Get all drivers with filters
router.get('/drivers', async (req, res) => {
  try {
    const db = req.db;
    const { status, search } = req.query;
    
    let query = `
      SELECT 
        d.id,
        d.user_id,
        d.full_name,
        d.phone,
        d.email,
        d.nik,
        d.place_of_birth,
        d.date_of_birth,
        d.address_full,
        d.vehicle_type,
        d.vehicle_plate,
        d.vehicle_color,
        d.vehicle_year,
        d.license_number,
        d.bank_name,
        d.bank_account_number,
        d.bank_account_holder,
        d.ktp_photo_url,
        d.selfie_photo_url,
        d.license_photo_url,
        d.stnk_photo_url,
        d.is_verified,
        d.status,
        d.rating,
        d.total_trips,
        d.created_at,
        u.is_active,
        u.username
      FROM independent_drivers d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE u.user_type = 'driver'
    `;
    
    const params = [];
    
    // Filter by status
    if (status && status !== 'all') {
      query += ` AND d.status = ?`;
      params.push(status);
    }
    
    // Search by name, phone, or email
    if (search) {
      query += ` AND (d.full_name LIKE ? OR d.phone LIKE ? OR d.email LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ` ORDER BY d.created_at DESC`;
    
    const [drivers] = await db.query(query, params);
    
    res.json({
      success: true,
      drivers: drivers
    });
  } catch (error) {
    console.error('Error loading drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load drivers',
      error: error.message
    });
  }
});

// Get single driver details
router.get('/drivers/:id', async (req, res) => {
  try {
    const db = req.db;
    const driverId = req.params.id;
    
    const [drivers] = await db.query(`
      SELECT 
        d.*,
        u.is_active,
        u.username,
        u.email as user_email
      FROM independent_drivers d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
    `, [driverId]);
    
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
    console.error('Error loading driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load driver details',
      error: error.message
    });
  }
});

// Approve driver
router.post('/drivers/:id/approve', async (req, res) => {
  try {
    const db = req.db;
    const driverId = req.params.id;
    
    // Get driver info
    const [drivers] = await db.query(
      'SELECT user_id, full_name, email FROM independent_drivers WHERE id = ?',
      [driverId]
    );
    
    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    const driver = drivers[0];
    
    // Update driver status
    await db.query(
      `UPDATE independent_drivers 
       SET status = 'approved', is_verified = 1, updated_at = NOW()
       WHERE id = ?`,
      [driverId]
    );
    
    // Update user account to active
    await db.query(
      `UPDATE users 
       SET is_active = 1, updated_at = NOW()
       WHERE id = ?`,
      [driver.user_id]
    );
    
    // TODO: Send email notification to driver
    // Example: await sendEmail(driver.email, 'approved', driver.full_name);
    
    res.json({
      success: true,
      message: `Driver ${driver.full_name} has been approved successfully`
    });
  } catch (error) {
    console.error('Error approving driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve driver',
      error: error.message
    });
  }
});

// Reject driver
router.post('/drivers/:id/reject', async (req, res) => {
  try {
    const db = req.db;
    const driverId = req.params.id;
    const { reason } = req.body;
    
    // Get driver info
    const [drivers] = await db.query(
      'SELECT user_id, full_name, email FROM independent_drivers WHERE id = ?',
      [driverId]
    );
    
    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    const driver = drivers[0];
    
    // Update driver status
    await db.query(
      `UPDATE independent_drivers 
       SET status = 'rejected', is_verified = 0, updated_at = NOW()
       WHERE id = ?`,
      [driverId]
    );
    
    // Keep user account inactive
    await db.query(
      `UPDATE users 
       SET is_active = 0, updated_at = NOW()
       WHERE id = ?`,
      [driver.user_id]
    );
    
    // TODO: Send email notification with rejection reason
    // Example: await sendEmail(driver.email, 'rejected', driver.full_name, reason);
    
    res.json({
      success: true,
      message: `Driver ${driver.full_name} has been rejected`
    });
  } catch (error) {
    console.error('Error rejecting driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject driver',
      error: error.message
    });
  }
});

// Delete driver (soft delete - keep records but mark as deleted)
router.delete('/drivers/:id', async (req, res) => {
  try {
    const db = req.db;
    const driverId = req.params.id;
    
    // Get driver info
    const [drivers] = await db.query(
      'SELECT user_id FROM independent_drivers WHERE id = ?',
      [driverId]
    );
    
    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    // Soft delete: update status to rejected and deactivate
    await db.query(
      `UPDATE independent_drivers 
       SET status = 'rejected', is_verified = 0, updated_at = NOW()
       WHERE id = ?`,
      [driverId]
    );
    
    await db.query(
      `UPDATE users 
       SET is_active = 0, updated_at = NOW()
       WHERE id = ?`,
      [drivers[0].user_id]
    );
    
    res.json({
      success: true,
      message: 'Driver has been deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete driver',
      error: error.message
    });
  }
});

module.exports = router;
