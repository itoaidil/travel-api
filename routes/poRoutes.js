const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcrypt');

// POST Login PO Admin
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Get user with PO details
    const query = `
      SELECT u.id, u.username, u.password_hash, u.user_type, 
             p.id as po_id, p.po_name, p.company_code,
             pa.full_name, pa.position
      FROM users u
      JOIN po_admins pa ON u.id = pa.user_id
      JOIN pos p ON pa.po_id = p.id
      WHERE u.username = ? AND u.user_type = 'po_admin' AND u.is_active = 1
    `;
    
    db.query(query, [username], async (err, results) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      
      if (results.length === 0) {
        return res.status(401).json({ success: false, message: 'Username atau password salah' });
      }
      
      const user = results[0];
      
      // Compare password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({ success: false, message: 'Username atau password salah' });
      }
      
      // Return user data without password
      res.json({
        success: true,
        data: {
          user_id: user.id,
          username: user.username,
          po_id: user.po_id,
          po_name: user.po_name,
          company_code: user.company_code,
          full_name: user.full_name,
          position: user.position
        }
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST Register new PO
router.post('/register', async (req, res) => {
  const { po_name, email, phone, address, username, password, admin_name, admin_position } = req.body;
  
  try {
    // Check if username or email already exists
    const checkUser = 'SELECT id FROM users WHERE username = ? OR email = ?';
    db.query(checkUser, [username, email], async (err, results) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      
      if (results.length > 0) {
        return res.status(400).json({ success: false, message: 'Username atau email sudah digunakan' });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Insert user (store as po_admin role)
      const insertUser = 'INSERT INTO users (username, email, password_hash, user_type, phone, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
      db.query(insertUser, [username, email, hashedPassword, 'po_admin', phone], (err, userResult) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }
        
        const userId = userResult.insertId;
        
        // Generate company code
        const companyCode = 'PO' + Date.now().toString().slice(-6);
        
        // Insert PO
        const insertPO = 'INSERT INTO pos (po_name, company_code, email, phone, address, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, NOW())';
        db.query(insertPO, [po_name, companyCode, email, phone, address], (err, poResult) => {
          if (err) {
            return res.status(500).json({ success: false, message: err.message });
          }
          
          const poId = poResult.insertId;
          
          // Insert PO Admin
          const insertPOAdmin = 'INSERT INTO po_admins (user_id, po_id, full_name, position) VALUES (?, ?, ?, ?)';
          db.query(insertPOAdmin, [userId, poId, admin_name || po_name, admin_position || 'Owner'], (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: err.message });
            }
            
            res.json({ 
              success: true, 
              message: 'Pendaftaran PO berhasil',
              po_id: poId 
            });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST Login PO
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  const query = `
    SELECT u.id as user_id, u.username, u.password_hash, u.user_type, 
           pa.po_id, p.po_name
    FROM users u
    JOIN po_admins pa ON u.id = pa.user_id
    JOIN pos p ON pa.po_id = p.id
    WHERE u.username = ? AND u.user_type IN ('po','po_admin') AND u.is_active = 1 AND p.is_active = 1
  `;
  
  db.query(query, [username], async (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    
    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
    
    const user = results[0];
    
    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
    
    res.json({ 
      success: true,
      data: {
        po_id: user.po_id,
        po_name: user.po_name,
        username: user.username
      }
    });
  });
});

// GET PO's vehicles
router.get('/:po_id/vehicles', (req, res) => {
  const { po_id } = req.params;
  const query = 'SELECT * FROM vehicles WHERE po_id = ?';
  
  db.query(query, [po_id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// POST create new vehicle
router.post('/vehicles', (req, res) => {
  const {
    po_id,
    vehicle_number,
    plate_number,
    vehicle_type,
    brand,
    model,
    year,
    capacity,
    is_active,
  } = req.body;

  const query = `
    INSERT INTO vehicles (po_id, vehicle_number, plate_number, vehicle_type, brand, model, year, capacity, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  db.query(
    query,
    [po_id, vehicle_number, plate_number, vehicle_type, brand, model, year || null, capacity || null, is_active ? 1 : 0],
    (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ 
        success: true, 
        data: {
          id: result.insertId,
          vehicle_id: result.insertId
        }
      });
    }
  );
});

// PUT update existing vehicle
router.put('/vehicles/:id', (req, res) => {
  const { id } = req.params;
  const {
    vehicle_number,
    plate_number,
    vehicle_type,
    brand,
    model,
    year,
    capacity,
    is_active,
  } = req.body;

  const query = `
    UPDATE vehicles SET vehicle_number = ?, plate_number = ?, vehicle_type = ?, brand = ?, model = ?, year = ?, capacity = ?, is_active = ?
    WHERE id = ?
  `;

  db.query(
    query,
    [vehicle_number, plate_number, vehicle_type, brand, model, year || null, capacity || null, is_active ? 1 : 0, id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true, affectedRows: result.affectedRows });
    }
  );
});

// GET vehicle schedules
router.get('/vehicles/:id/schedules', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM vehicle_schedules WHERE vehicle_id = ? AND is_active = TRUE';
  
  db.query(query, [id], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// POST create vehicle schedule
router.post('/vehicles/:id/schedules', (req, res) => {
  const { id } = req.params;
  const { destination, departure_times } = req.body;
  
  const query = 'INSERT INTO vehicle_schedules (vehicle_id, destination, departure_times) VALUES (?, ?, ?)';
  
  db.query(query, [id, destination, JSON.stringify(departure_times)], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, schedule_id: result.insertId });
  });
});

// PUT update vehicle schedule
router.put('/vehicles/:id/schedules/:schedule_id', (req, res) => {
  const { id, schedule_id } = req.params;
  const { destination, departure_times, is_active } = req.body;
  
  const query = `
    UPDATE vehicle_schedules 
    SET destination = ?, departure_times = ?, is_active = ? 
    WHERE id = ? AND vehicle_id = ?
  `;
  
  db.query(
    query, 
    [destination, JSON.stringify(departure_times), is_active, schedule_id, id], 
    (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      res.json({ success: true, affectedRows: result.affectedRows });
    }
  );
});

// DELETE vehicle schedule
router.delete('/vehicles/:id/schedules/:schedule_id', (req, res) => {
  const { id, schedule_id } = req.params;
  const query = 'DELETE FROM vehicle_schedules WHERE id = ? AND vehicle_id = ?';
  
  db.query(query, [schedule_id, id], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, affectedRows: result.affectedRows });
  });
});

// POST create new travel
router.post('/travels', (req, res) => {
  const { po_id, vehicle_id, driver_id, route_name, origin, destination, departure_time, arrival_time, price, total_seats } = req.body;
  
  const query = `
    INSERT INTO travels (po_id, vehicle_id, driver_id, route_name, origin, destination,
                        departure_time, arrival_time, price, available_seats, total_seats, 
                        status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', NOW())
  `;
  
  db.query(query, [po_id, vehicle_id, driver_id, route_name, origin, destination, departure_time, arrival_time, price, total_seats, total_seats], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, travel_id: result.insertId });
  });
});

// GET PO's travels
router.get('/:po_id/travels', (req, res) => {
  const { po_id } = req.params;
  const query = `
    SELECT t.*, v.plate_number, v.vehicle_type,
           d.full_name as driver_name,
           COUNT(b.id) as total_bookings
    FROM travels t
    JOIN vehicles v ON t.vehicle_id = v.id
    LEFT JOIN drivers d ON t.driver_id = d.id
    LEFT JOIN bookings b ON t.id = b.travel_id
    WHERE t.po_id = ?
    GROUP BY t.id
    ORDER BY t.departure_time DESC
  `;
  
  db.query(query, [po_id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// GET bookings for PO's travels
router.get('/:po_id/bookings', (req, res) => {
  const { po_id } = req.params;
  const query = `
    SELECT b.*, t.route_name, t.origin, t.destination, t.departure_time,
           s.full_name as student_name, u.phone as student_phone
    FROM bookings b
    JOIN travels t ON b.travel_id = t.id
    JOIN students s ON b.student_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE t.po_id = ?
    ORDER BY b.booked_at DESC
  `;
  
  db.query(query, [po_id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// GET all cities
router.get('/cities', (req, res) => {
  const query = 'SELECT * FROM cities WHERE is_active = 1 ORDER BY name ASC';
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// PUT update existing travel
router.put('/travels/:id', (req, res) => {
  const { id } = req.params;
  const {
    vehicle_id,
    driver_id,
    route_name,
    origin,
    destination,
    departure_time,
    arrival_time,
    price,
    total_seats,
  } = req.body;

  const query = `
    UPDATE travels SET 
      vehicle_id = ?, 
      driver_id = ?, 
      route_name = ?, 
      origin = ?, 
      destination = ?, 
      departure_time = ?, 
      arrival_time = ?, 
      price = ?, 
      total_seats = ?,
      available_seats = ?
    WHERE id = ?
  `;

  db.query(
    query,
    [vehicle_id, driver_id, route_name, origin, destination, departure_time, arrival_time, price, total_seats, total_seats, id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true, affectedRows: result.affectedRows });
    }
  );
});

// DELETE travel
router.delete('/travels/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM travels WHERE id = ?';

  db.query(query, [id], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, affectedRows: result.affectedRows });
  });
});

module.exports = router;
