const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/student', require('./routes/studentRoutes'));
app.use('/api/driver', require('./routes/driverRoutes'));
app.use('/api/po', require('./routes/poRoutes'));
app.use('/api/customer', require('./routes/customerRoutes'));

// Test database connection
db.query('SELECT 1', (err, results) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database connected successfully');
    
    // Ensure reviews table exists (simple schema) and seed demo data if empty
    const createReviewsTable = `CREATE TABLE IF NOT EXISTS po_reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      po_id INT NOT NULL,
      rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (po_id)
    )`;
    
    // Seat selections table to track which seats are booked for each travel
    const createSeatSelectionsTable = `CREATE TABLE IF NOT EXISTS seat_selections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      seat_number VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (booking_id),
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    )`;
    
    db.query(createReviewsTable, (err2) => {
      if (err2) {
        console.error('Failed ensuring po_reviews table:', err2.message);
        return;
      }
      
      db.query(createSeatSelectionsTable, (err3) => {
        if (err3) {
          console.error('Failed ensuring seat_selections table:', err3.message);
          return;
        }
        console.log('Tables verified/created: po_reviews, seat_selections');
      });
      
      db.query('SELECT COUNT(*) as cnt FROM po_reviews', (err3, rows) => {
        if (err3) {
          console.error('Count po_reviews failed:', err3.message);
          return;
        }
        const count = rows[0].cnt;
        if (count === 0) {
          // Seed a few demo reviews per active PO for UI purposes
          const seedQuery = `INSERT INTO po_reviews (po_id, rating, comment)
            SELECT p.id, FLOOR(3 + RAND()*2), CONCAT('Sample review for ', p.po_name)
            FROM pos p WHERE p.is_active = 1 LIMIT 15`;
          db.query(seedQuery, (err4) => {
            if (err4) {
              console.error('Seeding po_reviews failed:', err4.message);
            } else {
              console.log('Seeded demo po_reviews data');
            }
          });
        }
      });
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Travel API Server is running' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Travel API Server running on http://0.0.0.0:${PORT}`);
  console.log(`Access from network: http://192.168.18.7:${PORT}`);
});
