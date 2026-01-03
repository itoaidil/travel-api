const mysql = require('mysql2/promise');
const fs = require('fs');

// Railway Public Database
const dbConfig = {
  host: 'turntable.proxy.rlwy.net',
  port: 31765,
  user: 'root',
  password: 'zJRybpszurLxJoXAqLBvaBijPvYpMKNA',
  database: 'railway'
};

const TRAVEL_ID = 65; // Padang → Bonjol

async function createBookings() {
  let connection;
  console.log(`🎫 Creating bookings for Travel ID ${TRAVEL_ID}...\n`);
  
  try {
    // Load students data
    const students = JSON.parse(fs.readFileSync('./test_students_data.json', 'utf8'));
    console.log(`📋 Loaded ${students.length} students\n`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to Railway!\n');
    
    // Get student IDs from database
    for (let s of students) {
      const [rows] = await connection.query(
        'SELECT s.id as student_id FROM students s JOIN users u ON u.id = s.user_id WHERE u.phone = ?',
        [s.phone]
      );
      if (rows.length > 0) {
        s.studentId = rows[0].student_id;
      }
    }
    
    // Get available seats
    const [existingSeats] = await connection.query(
      'SELECT seat_number FROM booking_seats bs JOIN bookings b ON b.id = bs.booking_id WHERE b.travel_id = ?',
      [TRAVEL_ID]
    );
    
    const takenSeats = existingSeats.map(r => r.seat_number);
    console.log(`🪑 Taken seats: ${takenSeats.join(', ') || 'none'}\n`);
    
    const availableSeats = [1,2,3,4,5,6,7,8].filter(s => !takenSeats.includes(s));
    
    for (let i = 0; i < students.length && i < availableSeats.length; i++) {
      const student = students[i];
      const seatNumber = availableSeats[i];
      
      if (!student.studentId) {
        console.log(`${i + 1}. ⚠️  ${student.full_name} - No student_id found, skipping`);
        continue;
      }
      
      console.log(`${i + 1}. ${student.full_name} - Seat ${seatNumber}...`);
      
      // Check if booking already exists
      const [existing] = await connection.query(
        'SELECT id FROM bookings WHERE student_id = ? AND travel_id = ?',
        [student.studentId, TRAVEL_ID]
      );
      
      if (existing.length > 0) {
        console.log(`   ⚠️  Booking already exists`);
        continue;
      }
      
      // Create booking
      const bookingCode = 'BK' + Date.now() + Math.floor(Math.random() * 1000);
      const [bookingResult] = await connection.query(
        `INSERT INTO bookings (
          travel_id, student_id, booking_code, total_price, 
          payment_status, booking_status, 
          pickup_location, pickup_lat, pickup_lng,
          dropoff_location, dropoff_lat, dropoff_lng,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          TRAVEL_ID,
          student.studentId,
          bookingCode,
          50000, // price
          'paid',
          'confirmed',
          `${student.pickup.name}, ${student.university}`,
          student.pickup.lat,
          student.pickup.lng,
          'Bonjol, Dharmasraya',
          -0.1581,
          100.8667
        ]
      );
      
      // Create seat assignment
      await connection.query(
        'INSERT INTO booking_seats (booking_id, seat_number) VALUES (?, ?)',
        [bookingResult.insertId, seatNumber]
      );
      
      console.log(`   ✅ Booking created (${bookingCode})`);
      console.log(`   🪑 Seat ${seatNumber} assigned`);
      console.log(`   📍 Pickup: ${student.pickup.name}`);
      console.log('');
    }
    
    console.log('\n✅ All bookings created!\n');
    console.log('🎯 NEXT STEP:');
    console.log('='.repeat(50));
    console.log('1. Buka driver app');
    console.log('2. Login: 085213947740 / driver123');
    console.log(`3. Tap travel "Padang → Bonjol"`);
    console.log('4. Lihat semua marker merah di map!\n');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

createBookings();
