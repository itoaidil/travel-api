const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { Resend } = require('resend');

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Generate random password
function generateRandomPassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Send approval email with credentials using Resend
async function sendApprovalEmail(email, fullName, phone, password) {
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Hantar Ride <onboarding@resend.dev>',
    to: [email],
    subject: '✅ Akun Driver Anda Telah Disetujui!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
          .credential-item { margin: 10px 0; }
          .credential-label { font-weight: bold; color: #6b7280; }
          .credential-value { font-size: 18px; color: #1f2937; font-weight: bold; }
          .button { display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
          .warning { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Selamat!</h1>
            <p>Akun Driver Anda Telah Disetujui</p>
          </div>
          <div class="content">
            <p>Halo <strong>${fullName}</strong>,</p>
            
            <p>Selamat! Akun driver Anda telah diverifikasi dan disetujui oleh tim kami.</p>
            
            <div class="credentials">
              <h3 style="margin-top: 0; color: #1f2937;">📱 Informasi Login Anda</h3>
              
              <div class="credential-item">
                <div class="credential-label">Username (Nomor HP):</div>
                <div class="credential-value">${phone}</div>
              </div>
              
              <div class="credential-item">
                <div class="credential-label">Password:</div>
                <div class="credential-value">${password}</div>
              </div>
            </div>
            
            <div class="warning">
              <strong>⚠️ Penting:</strong> Simpan password ini dengan aman. Anda bisa mengubah password setelah login pertama kali.
            </div>
            
            <p><strong>Anda sekarang dapat:</strong></p>
            <ul>
              <li>✅ Login ke aplikasi Hantar Ride Driver</li>
              <li>✅ Mulai menerima pesanan</li>
              <li>✅ Mendapatkan penghasilan</li>
            </ul>
            
            <p>Silahkan download aplikasi driver dan login dengan kredensial di atas.</p>
            
            <p>Jika ada pertanyaan, silahkan hubungi tim support kami.</p>
            
            <p>Terima kasih telah bergabung dengan Hantar Ride!</p>
            
            <p style="margin-top: 30px;">
              Salam hangat,<br>
              <strong>Tim Hantar Ride</strong>
            </p>
          </div>
          <div class="footer">
            <p>Email ini dikirim otomatis, mohon tidak membalas email ini.</p>
            <p>&copy; 2026 Hantar Ride. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
}

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
    
    // Get driver info including phone
    const [drivers] = await db.query(
      'SELECT user_id, full_name, email, phone FROM independent_drivers WHERE id = ?',
      [driverId]
    );
    
    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    const driver = drivers[0];
    
    // Generate random password
    const newPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update driver status to 'active' (ENUM values: pending, active, inactive, offline)
    await db.query(
      `UPDATE independent_drivers 
       SET status = 'active', is_verified = 1, updated_at = NOW()
       WHERE id = ?`,
      [driverId]
    );
    
    // Update user account: activate and set new password
    await db.query(
      `UPDATE users 
       SET is_active = 1, password = ?, updated_at = NOW()
       WHERE id = ?`,
      [hashedPassword, driver.user_id]
    );
    
    // Send email notification with credentials
    try {
      await sendApprovalEmail(driver.email, driver.full_name, driver.phone, newPassword);
      console.log(`✅ Approval email sent to ${driver.email}`);
    } catch (emailError) {
      console.error('⚠️ Failed to send email:', emailError.message);
      // Don't fail the approval if email fails
    }
    
    res.json({
      success: true,
      message: `Driver ${driver.full_name} has been approved successfully. Credentials sent to ${driver.email}`
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
