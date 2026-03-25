const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'hantar-travel-secret-key-2025';

async function ensureFranchiseAdminUsersTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS franchise_admin_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      franchise_partner_id INT NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(120) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_login_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uniq_franchise_admin_email (email),
      INDEX idx_franchise_partner (franchise_partner_id),
      INDEX idx_is_active (is_active),

      CONSTRAINT fk_franchise_admin_users_partner
        FOREIGN KEY (franchise_partner_id)
        REFERENCES franchise_partners(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function parseBearerToken(header = '') {
  if (!header || typeof header !== 'string') return null;
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

function signFranchiseAdminToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

function verifyFranchiseAdminToken(req, res, next) {
  const token = parseBearerToken(req.headers.authorization || '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing authorization token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded?.userType !== 'franchise_admin' || !decoded?.franchisePartnerId) {
      return res.status(401).json({ success: false, message: 'Invalid token scope' });
    }

    req.franchiseAdmin = {
      userId: decoded.userId,
      franchisePartnerId: Number(decoded.franchisePartnerId),
      email: decoded.email,
      fullName: decoded.fullName
    };

    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

/**
 * POST /api/franchise-admin/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  const db = req.db;
  if (!db) {
    return res.status(500).json({ success: false, message: 'Database not available' });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    await ensureFranchiseAdminUsersTable(db);

    const [rows] = await db.query(
      `SELECT
         fau.id,
         fau.franchise_partner_id,
         fau.full_name,
         fau.email,
         fau.password_hash,
         fau.is_active,
         fp.name AS franchise_name,
         fp.status AS franchise_status,
         fp.city AS franchise_city
       FROM franchise_admin_users fau
       INNER JOIN franchise_partners fp ON fp.id = fau.franchise_partner_id
       WHERE LOWER(fau.email) = LOWER(?)
       LIMIT 1`,
      [String(email).trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Akun franchise admin tidak aktif' });
    }

    if (user.franchise_status !== 'active') {
      return res.status(403).json({ success: false, message: 'Franchise belum aktif. Hubungi admin.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    await db.query('UPDATE franchise_admin_users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = signFranchiseAdminToken({
      userId: user.id,
      franchisePartnerId: user.franchise_partner_id,
      email: user.email,
      fullName: user.full_name,
      userType: 'franchise_admin'
    });

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        user_id: user.id,
        full_name: user.full_name,
        email: user.email,
        franchise_partner_id: user.franchise_partner_id,
        franchise_name: user.franchise_name,
        franchise_city: user.franchise_city
      }
    });
  } catch (error) {
    console.error('❌ Franchise admin login error:', error);
    return res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
});

/**
 * GET /api/franchise-admin/auth/me
 */
router.get('/me', verifyFranchiseAdminToken, async (req, res) => {
  const db = req.db;
  if (!db) {
    return res.status(500).json({ success: false, message: 'Database not available' });
  }

  try {
    await ensureFranchiseAdminUsersTable(db);

    const [rows] = await db.query(
      `SELECT
         fau.id,
         fau.franchise_partner_id,
         fau.full_name,
         fau.email,
         fau.is_active,
         fp.name AS franchise_name,
         fp.status AS franchise_status,
         fp.city AS franchise_city
       FROM franchise_admin_users fau
       INNER JOIN franchise_partners fp ON fp.id = fau.franchise_partner_id
       WHERE fau.id = ?
       LIMIT 1`,
      [req.franchiseAdmin.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];

    return res.json({
      success: true,
      data: {
        user_id: user.id,
        full_name: user.full_name,
        email: user.email,
        is_active: user.is_active,
        franchise_partner_id: user.franchise_partner_id,
        franchise_name: user.franchise_name,
        franchise_status: user.franchise_status,
        franchise_city: user.franchise_city
      }
    });
  } catch (error) {
    console.error('❌ Franchise admin profile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load profile', error: error.message });
  }
});

module.exports = { router, verifyFranchiseAdminToken, ensureFranchiseAdminUsersTable };