const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET travel destination suggestions (autocomplete) - from cities table
router.get('/suggestions', (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.json({ success: true, data: [] });
  }

  const searchQuery = `
    SELECT name 
    FROM cities 
    WHERE name LIKE ? AND is_active = 1
    ORDER BY name
    LIMIT 10
  `;
  
  db.query(searchQuery, [`%${query}%`], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, data: results.map(r => r.name) });
  });
});

// GET departure cities - get distinct origin cities from travels
router.get('/departure-cities', (req, res) => {
  const query = `
    SELECT DISTINCT origin as name
    FROM travels 
    WHERE status = 'scheduled'
    ORDER BY origin
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    const cities = results.map(r => r.name);
    res.json(cities);
  });
});

// GET destination cities - get distinct destinations based on origin from travels
router.get('/destination-cities', (req, res) => {
  const { from } = req.query;
  
  if (!from) {
    return res.status(400).json({ success: false, message: 'Parameter from required' });
  }
  
  const query = `
    SELECT DISTINCT destination as name
    FROM travels 
    WHERE status = 'scheduled' AND origin = ?
    ORDER BY destination
  `;
  
  db.query(query, [from], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    const cities = results.map(r => r.name);
    res.json(cities);
  });
});

// GET search PO by route (origin and destination)
router.get('/search-po', (req, res) => {
  const { from, to } = req.query;
  
  if (!from || !to) {
    return res.status(400).json({ 
      success: false, 
      message: 'Parameter from and to required' 
    });
  }
  
  const query = `
    SELECT 
      p.id,
      p.po_name,
      p.company_code,
      p.email,
      p.phone,
      p.address,
      COUNT(DISTINCT v.id) as vehicle_count
    FROM pos p
    JOIN vehicles v ON p.id = v.po_id
    JOIN travels t ON v.id = t.vehicle_id
    WHERE p.is_active = 1 
      AND v.is_active = 1
      AND t.status = 'scheduled'
      AND t.origin = ?
      AND t.destination = ?
    GROUP BY p.id, p.po_name, p.company_code, p.email, p.phone, p.address
    ORDER BY p.po_name
  `;
  
  db.query(query, [from, to], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// GET schedules by PO and route
router.get('/schedules', (req, res) => {
  const { po_id, from, to, date } = req.query;
  
  if (!po_id || !from || !to) {
    return res.status(400).json({ 
      success: false, 
      message: 'Parameter po_id, from, and to required' 
    });
  }
  
  let query = `
    SELECT 
      t.id as travel_id,
      t.origin,
      t.destination,
      t.departure_time,
      t.arrival_time,
      t.price,
      t.status as travel_status,
      v.id as vehicle_id,
      v.vehicle_type as vehicle_name,
      v.plate_number as license_plate,
      v.capacity,
      v.brand,
      v.model,
      v.year,
      p.id as po_id,
      p.po_name,
      p.company_code,
      COALESCE(
        (SELECT COUNT(*) 
         FROM booking_seats bs 
         JOIN bookings b ON bs.booking_id = b.id 
         WHERE b.travel_id = t.id 
         AND b.booking_status IN ('pending', 'confirmed', 'paid')),
        0
      ) as booked_seats
    FROM travels t
    JOIN vehicles v ON t.vehicle_id = v.id
    JOIN pos p ON v.po_id = p.id
    WHERE p.id = ?
      AND t.origin = ?
      AND t.destination = ?
      AND t.status = 'scheduled'
      AND v.is_active = 1
      AND p.is_active = 1`;
  
  const queryParams = [po_id, from, to];
  
  // Add date filter if provided
  if (date) {
    query += ` AND DATE(t.departure_time) = ?`;
    queryParams.push(date);
  }
  
  query += ` ORDER BY t.departure_time ASC`;
  
  db.query(query, queryParams, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    
    // Calculate available seats for each schedule
    const schedules = results.map(schedule => ({
      ...schedule,
      available_seats: schedule.capacity - schedule.booked_seats
    }));
    
    res.json({ success: true, data: schedules });
  });
});

// POST Login Student
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email dan password harus diisi' 
    });
  }

  // Query to get student auth and student info
  const query = `
    SELECT 
      sa.id as auth_id,
      sa.email,
      sa.password,
      s.id as student_id,
      s.full_name,
      s.student_id as nim,
      s.university,
      s.address,
      s.emergency_contact
    FROM student_auth sa
    JOIN students s ON sa.student_id = s.id
    WHERE sa.email = ? AND sa.is_active = 1
  `;

  db.query(query, [email], (err, results) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: err.message 
      });
    }

    if (results.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email atau password salah' 
      });
    }

    const student = results[0];

    // Simple password check (in production, use bcrypt)
    if (student.password !== password) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email atau password salah' 
      });
    }

    // Return student data (excluding password)
    res.json({ 
      success: true, 
      data: {
        auth_id: student.auth_id,
        student_id: student.student_id,
        email: student.email,
        full_name: student.full_name,
        nim: student.nim,
        university: student.university,
        address: student.address,
        emergency_contact: student.emergency_contact
      }
    });
  });
});

// GET vehicles by schedule (NEW SYSTEM - uses vehicle_schedules)
router.get('/vehicles-by-schedule', (req, res) => {
  const { destination, date } = req.query;
  
  let query = `
    SELECT 
      v.id as vehicle_id,
      v.vehicle_number,
      v.plate_number,
      v.vehicle_type,
      v.capacity,
      v.brand,
      v.model,
      p.id as po_id,
      p.po_name,
      p.phone as po_phone,
      vs.id as schedule_id,
      vs.destination,
      vs.departure_times
    FROM vehicles v
    JOIN pos p ON v.po_id = p.id
    JOIN vehicle_schedules vs ON v.id = vs.vehicle_id
    WHERE v.is_active = 1 AND vs.is_active = 1
  `;
  
  const params = [];
  
  if (destination) {
    query += ` AND vs.destination = ?`;
    params.push(destination);
  }
  
  query += ` ORDER BY p.po_name, v.vehicle_number`;
  
  db.query(query, params, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Parse departure_times JSON string to array
    const parsedResults = results.map(row => {
      try {
        row.departure_times = typeof row.departure_times === 'string' 
          ? JSON.parse(row.departure_times) 
          : row.departure_times;
      } catch (e) {
        row.departure_times = [];
      }
      return row;
    });
    
    res.json({ success: true, data: parsedResults });
  });
});

// GET all travels (for student to browse - OLD SYSTEM)
router.get('/travels', (req, res) => {
  const { origin, destination, date } = req.query;
  
  let query = `
    SELECT t.*, p.po_name,
           v.vehicle_number, v.plate_number, v.capacity,
           v.vehicle_type, v.brand, v.model
    FROM travels t
    JOIN pos p ON t.po_id = p.id
    JOIN vehicles v ON t.vehicle_id = v.id
    WHERE t.status = 'scheduled'
  `;
  
  const params = [];
  
  if (origin) {
    query += ` AND t.origin = ?`;
    params.push(origin);
  }
  
  if (destination) {
    query += ` AND t.destination = ?`;
    params.push(destination);
  }
  
  if (date) {
    query += ` AND DATE(t.departure_time) = ?`;
    params.push(date);
  }
  
  query += ` ORDER BY t.departure_time`;
  
  db.query(query, params, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// GET travel details
router.get('/travels/:id', (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT t.*, p.po_name, p.phone as po_phone,
           v.plate_number, v.vehicle_type, v.capacity,
           d.full_name as driver_name, ud.phone as driver_phone
    FROM travels t
    JOIN pos p ON t.po_id = p.id
    JOIN vehicles v ON t.vehicle_id = v.id
    LEFT JOIN drivers d ON t.driver_id = d.id
    LEFT JOIN users ud ON d.user_id = ud.id
    WHERE t.id = ?
  `;
  
  db.query(query, [id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Travel not found' });
    }
    res.json({ success: true, data: results[0] });
  });
});

// POST create booking
router.post('/bookings', (req, res) => {
  const { 
    student_id, 
    travel_id, 
    pickup_location, 
    dropoff_location, 
    num_passengers,
    pickup_lat,
    pickup_lng,
    pickup_address,
    dropoff_lat,
    dropoff_lng,
    dropoff_address
  } = req.body;
  
  const query = `
    INSERT INTO bookings (
      student_id, travel_id, pickup_location, dropoff_location, 
      num_passengers, booking_status,
      pickup_lat, pickup_lng, pickup_address,
      dropoff_lat, dropoff_lng, dropoff_address
    )
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
  `;
  
  db.query(
    query, 
    [
      student_id, travel_id, pickup_location, dropoff_location, num_passengers,
      pickup_lat, pickup_lng, pickup_address,
      dropoff_lat, dropoff_lng, dropoff_address
    ], 
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, booking_id: result.insertId });
    }
  );
});

// GET student bookings
router.get('/bookings/:student_id', (req, res) => {
  const { student_id } = req.params;
  const query = `
    SELECT b.*, 
           t.route_name, t.origin, t.destination, t.departure_time, t.price,
           p.po_name,
           v.plate_number as vehicle_number
    FROM bookings b
    JOIN travels t ON b.travel_id = t.id
    JOIN pos p ON t.po_id = p.id
    LEFT JOIN vehicles v ON t.vehicle_id = v.id
    WHERE b.student_id = ?
    ORDER BY t.departure_time DESC
  `;
  
  db.query(query, [student_id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// GET aggregated PO ratings (average & review count)
router.get('/po-ratings', (req, res) => {
  const query = `
    SELECT 
      p.id AS po_id,
      p.po_name,
      COALESCE(ROUND(AVG(r.rating), 2), 4.5) AS average_rating,
      COUNT(r.id) AS review_count
    FROM pos p
    LEFT JOIN po_reviews r ON p.id = r.po_id
    WHERE p.is_active = 1
    GROUP BY p.id
    ORDER BY average_rating DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// GET vehicles with schedules for a specific PO and route
router.get('/po/:po_id/vehicles', (req, res) => {
  const { po_id } = req.params;
  const { origin, destination, date } = req.query;
  
  let query = `
    SELECT 
      v.id as vehicle_id,
      v.vehicle_number,
      v.plate_number,
      v.vehicle_type,
      v.brand,
      v.model,
      v.capacity,
      t.id as travel_id,
      t.route_name,
      t.origin,
      t.destination,
      t.departure_time,
      t.arrival_time,
      t.price,
      t.available_seats,
      t.total_seats,
      t.status
    FROM vehicles v
    LEFT JOIN travels t ON v.id = t.vehicle_id AND t.status = 'scheduled'
    WHERE v.po_id = ? AND v.is_active = 1
  `;
  
  const params = [po_id];
  
  if (origin) {
    query += ` AND t.origin = ?`;
    params.push(origin);
  }
  
  if (destination) {
    query += ` AND t.destination = ?`;
    params.push(destination);
  }
  
  if (date) {
    query += ` AND DATE(t.departure_time) = ?`;
    params.push(date);
  }
  
  query += ` ORDER BY v.vehicle_number, t.departure_time`;
  
  db.query(query, params, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    
    // Group by vehicle
    const vehicleMap = {};
    results.forEach(row => {
      if (!vehicleMap[row.vehicle_id]) {
        vehicleMap[row.vehicle_id] = {
          vehicle_id: row.vehicle_id,
          vehicle_number: row.vehicle_number,
          plate_number: row.plate_number,
          vehicle_type: row.vehicle_type,
          brand: row.brand,
          model: row.model,
          capacity: row.capacity,
          schedules: []
        };
      }
      if (row.travel_id) {
        vehicleMap[row.vehicle_id].schedules.push({
          travel_id: row.travel_id,
          route_name: row.route_name,
          origin: row.origin,
          destination: row.destination,
          departure_time: row.departure_time,
          arrival_time: row.arrival_time,
          price: row.price,
          available_seats: row.available_seats,
          total_seats: row.total_seats,
          status: row.status
        });
      }
    });
    
    res.json({ success: true, data: Object.values(vehicleMap) });
  });
});

// GET booked seats for a travel
router.get('/travels/:travel_id/booked-seats', (req, res) => {
  const { travel_id } = req.params;
  
  const query = `
    SELECT bs.seat_number
    FROM booking_seats bs
    JOIN bookings b ON bs.booking_id = b.id
    WHERE b.travel_id = ? AND b.booking_status IN ('pending', 'confirmed', 'paid', 'boarded', 'completed')
    ORDER BY bs.seat_number
  `;
  
  db.query(query, [travel_id], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    const bookedSeats = results.map(r => r.seat_number);
    res.json({ success: true, data: bookedSeats });
  });
});

// GET booked seats - alternative path (for query string)
router.get('/booked-seats', (req, res) => {
  const { travel_id } = req.query;
  
  if (!travel_id) {
    return res.status(400).json({ success: false, message: 'travel_id is required' });
  }
  
  const query = `
    SELECT bs.seat_number
    FROM booking_seats bs
    JOIN bookings b ON bs.booking_id = b.id
    WHERE b.travel_id = ? AND b.booking_status IN ('pending', 'confirmed', 'paid', 'boarded', 'completed')
    ORDER BY bs.seat_number
  `;
  
  db.query(query, [travel_id], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    const bookedSeats = results.map(r => r.seat_number);
    res.json({ success: true, bookedSeats: bookedSeats });
  });
});

// POST create booking with seat selection
router.post('/bookings-with-seats', (req, res) => {
  const { student_id, travel_id, pickup_location, dropoff_location, selected_seats } = req.body;
  
  if (!selected_seats || selected_seats.length === 0) {
    return res.status(400).json({ success: false, message: 'Pilih minimal 1 kursi' });
  }
  
  // Generate booking code
  const bookingCode = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;
  
  // Start transaction
  db.beginTransaction((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    
    // Get travel price first
    db.query('SELECT price FROM travels WHERE id = ?', [travel_id], (err, travelResults) => {
      if (err) {
        return db.rollback(() => {
          res.status(500).json({ success: false, message: err.message });
        });
      }
      
      if (travelResults.length === 0) {
        return db.rollback(() => {
          res.status(404).json({ success: false, message: 'Travel not found' });
        });
      }
      
      const pricePerSeat = travelResults[0].price;
      const totalPrice = pricePerSeat * selected_seats.length;
      
      // Create booking
      const bookingQuery = `
        INSERT INTO bookings (booking_code, student_id, travel_id, pickup_location, dropoff_location, 
                             seats_booked, num_passengers, total_price, booking_status, payment_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid')
      `;
      
      db.query(
        bookingQuery,
        [bookingCode, student_id, travel_id, pickup_location, dropoff_location, 
         selected_seats.length, selected_seats.length, totalPrice],
        (err, result) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json({ success: false, message: err.message });
            });
          }
          
          const bookingId = result.insertId;
          
          // Insert seat selections
          const seatValues = selected_seats.map(seat => [bookingId, seat]);
          const seatQuery = `INSERT INTO seat_selections (booking_id, seat_number) VALUES ?`;
          
          db.query(seatQuery, [seatValues], (err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json({ success: false, message: err.message });
              });
            }
            
            // Update available seats in travel
            const updateQuery = `
              UPDATE travels 
              SET available_seats = available_seats - ? 
              WHERE id = ? AND available_seats >= ?
            `;
            
            db.query(
              updateQuery,
              [selected_seats.length, travel_id, selected_seats.length],
              (err, updateResult) => {
                if (err) {
                  return db.rollback(() => {
                    res.status(500).json({ success: false, message: err.message });
                  });
                }
                
                if (updateResult.affectedRows === 0) {
                  return db.rollback(() => {
                    res.status(400).json({ 
                      success: false, 
                      message: 'Kursi tidak tersedia' 
                    });
                  });
                }
                
                // Commit transaction
                db.commit((err) => {
                  if (err) {
                    return db.rollback(() => {
                      res.status(500).json({ success: false, message: err.message });
                    });
                  }
                  
                  res.json({ 
                    success: true, 
                    booking_id: bookingId,
                    booking_code: bookingCode,
                    seats: selected_seats,
                    total_price: totalPrice
                  });
                });
              }
            );
          });
        }
      );
    });
  });
});

module.exports = router;
