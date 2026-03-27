const express = require('express');
const router = express.Router();

/**
 * Auto-create tables if not exist
 */
async function ensureTables(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS job_listings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      qualifications TEXT,
      duration VARCHAR(150),
      location VARCHAR(255) DEFAULT 'Tangerang, Banten',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS job_applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_id INT NOT NULL,
      -- Identitas
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      address TEXT,
      birth_date DATE,
      gender ENUM('male','female','other'),
      -- Pendidikan
      education_level VARCHAR(100),
      education_institution VARCHAR(255),
      education_major VARCHAR(255),
      education_year INT,
      education_gpa DECIMAL(3,2),
      -- Pengalaman
      work_experience TEXT,
      -- Dokumen (Cloudinary URLs)
      cv_url VARCHAR(512),
      certificate_url VARCHAR(512),
      -- Status
      status ENUM('pending','reviewed','accepted','rejected') DEFAULT 'pending',
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES job_listings(id) ON DELETE CASCADE,
      INDEX idx_job (job_id),
      INDEX idx_email (email),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

/**
 * GET /api/jobs
 * List all active job listings
 */
router.get('/', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    await ensureTables(db);
    const [rows] = await db.query(
      `SELECT id, title, description, qualifications, duration, location, created_at
       FROM job_listings WHERE is_active = 1 ORDER BY created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/jobs/apply
 * Submit a job application
 */
router.post('/apply', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    await ensureTables(db);

    const {
      job_id, full_name, email, phone, address, birth_date, gender,
      education_level, education_institution, education_major, education_year, education_gpa,
      work_experience, cv_url, certificate_url
    } = req.body;

    if (!job_id || !full_name || !email) {
      return res.status(400).json({ success: false, message: 'job_id, full_name, dan email wajib diisi' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Format email tidak valid' });
    }

    // Check for duplicate application
    const [existing] = await db.query(
      'SELECT id FROM job_applications WHERE job_id = ? AND email = ?',
      [job_id, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email ini sudah pernah mendaftar untuk posisi ini' });
    }

    const [result] = await db.query(
      `INSERT INTO job_applications
       (job_id, full_name, email, phone, address, birth_date, gender,
        education_level, education_institution, education_major, education_year, education_gpa,
        work_experience, cv_url, certificate_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job_id, full_name, email,
        phone || null, address || null,
        birth_date || null, gender || null,
        education_level || null, education_institution || null,
        education_major || null, education_year || null, education_gpa || null,
        work_experience || null, cv_url || null, certificate_url || null
      ]
    );

    res.json({ success: true, message: 'Lamaran berhasil dikirim!', application_id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/jobs/admin/list
 * Admin: list all applications (basic)
 */
router.get('/admin/list', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.full_name, a.email, a.phone, a.status, a.applied_at,
              j.title as job_title
       FROM job_applications a
       JOIN job_listings j ON j.id = a.job_id
       ORDER BY a.applied_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/jobs/admin/jobs
 * Admin: list job listings (including inactive)
 */
router.get('/admin/jobs', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    await ensureTables(db);
    const active = (req.query.active || 'all').toLowerCase();

    let whereClause = '';
    if (active === 'active') whereClause = 'WHERE is_active = 1';
    if (active === 'inactive') whereClause = 'WHERE is_active = 0';

    const [rows] = await db.query(
      `SELECT id, title, description, qualifications, duration, location, is_active, created_at, updated_at
       FROM job_listings ${whereClause}
       ORDER BY created_at DESC`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/jobs/admin/create
 * Admin: create a new job listing (simple, no auth for now)
 */
router.post('/admin/create', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    await ensureTables(db);
    const { title, description, qualifications, duration, location } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'title wajib diisi' });

    const [result] = await db.query(
      `INSERT INTO job_listings (title, description, qualifications, duration, location)
       VALUES (?, ?, ?, ?, ?)`,
      [title, description || null, qualifications || null, duration || null, location || 'Tangerang, Banten']
    );
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/jobs/admin/:id
 * Admin: update a job listing
 */
router.put('/admin/:id', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    await ensureTables(db);
    const { id } = req.params;
    const { title, description, qualifications, duration, location, is_active } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'title wajib diisi' });

    const [result] = await db.query(
      `UPDATE job_listings
       SET title = ?, description = ?, qualifications = ?, duration = ?, location = ?,
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        title,
        description || null,
        qualifications || null,
        duration || null,
        location || 'Tangerang, Banten',
        typeof is_active === 'undefined' ? null : (is_active ? 1 : 0),
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Lowongan tidak ditemukan' });
    }

    res.json({ success: true, message: 'Lowongan berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/jobs/admin/:id
 * Admin: soft delete (set inactive)
 */
router.delete('/admin/:id', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    await ensureTables(db);
    const { id } = req.params;

    const [result] = await db.query(
      `UPDATE job_listings SET is_active = 0 WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Lowongan tidak ditemukan' });
    }

    res.json({ success: true, message: 'Lowongan dinonaktifkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/jobs/admin/:id/activate
 * Admin: activate listing
 */
router.post('/admin/:id/activate', async (req, res) => {
  const db = req.db;
  if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
  try {
    await ensureTables(db);
    const { id } = req.params;

    const [result] = await db.query(
      `UPDATE job_listings SET is_active = 1 WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Lowongan tidak ditemukan' });
    }

    res.json({ success: true, message: 'Lowongan diaktifkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
