const db = require('./config/database');
const fs = require('fs');

async function createBookingsForStudents() {
  console.log('🎫 Creating bookings for test students...\n');

  // Load student data
  let students;
  try {
    students = JSON.parse(fs.readFileSync('./test_students_data.json', 'utf8'));
  } catch (error) {
    console.error('❌ Error: test_students_data.json not found!');
    console.log('   Please run create_test_students.js first\n');
    process.exit(1);
  }

  // Travel info: Padang → Bonjol (Travel ID 65)
  const travelId = 65;
  const destination = {
    name: 'Bonjol',
    address: 'Bonjol, Dharmasraya, Sumatera Barat',
    lat: -1.1682956,
    lng: 101.627418
  };

  // Available seats: 1-8
  const availableSeats = [6, 7, 8, 4, 5]; // Seats 1,2,3 already taken by aidil

  try {
    console.log(`Travel: Padang → Bonjol (ID: ${travelId})`);
    console.log(`Creating ${students.length} bookings...\n`);

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const seatNumber = availableSeats[i];

      console.log(`${i + 1}. Booking for ${student.full_name}...`);
      console.log(`   Seat: ${seatNumber}`);
      console.log(`   Pickup: ${student.pickup.name}`);

      // Create booking
      const [bookingResult] = await db.query(
        `INSERT INTO bookings (
          travel_id,
          student_id,
          customer_id,
          booking_date,
          num_passengers,
          total_price,
          booking_status,
          payment_status,
          pickup_location,
          pickup_address,
          pickup_lat,
          pickup_lng,
          dropoff_location,
          dropoff_address,
          dropoff_lat,
          dropoff_lng,
          created_at
        ) VALUES (?, ?, NULL, NOW(), 1, 50000, 'confirmed', 'paid', ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          travelId,
          student.studentId,
          student.pickup.name,
          student.pickup.address,
          student.pickup.lat,
          student.pickup.lng,
          destination.name,
          destination.address,
          destination.lat,
          destination.lng
        ]
      );

      const bookingId = bookingResult.insertId;

      // Assign seat
      await db.query(
        `INSERT INTO booking_seats (booking_id, seat_number, created_at) 
         VALUES (?, ?, NOW())`,
        [bookingId, seatNumber]
      );

      console.log(`   ✅ Booking created (ID: ${bookingId}, Seat: ${seatNumber})`);
      console.log('');
    }

    // Get total bookings for this travel
    const [totalBookings] = await db.query(
      `SELECT COUNT(*) as total FROM bookings 
       WHERE travel_id = ? AND booking_status IN ('confirmed', 'paid')`,
      [travelId]
    );

    console.log('\n✅ All bookings created successfully!\n');
    console.log('📊 SUMMARY:');
    console.log('=' .repeat(60));
    console.log(`Travel ID: ${travelId}`);
    console.log(`Route: Padang → Bonjol`);
    console.log(`Total Passengers: ${totalBookings[0].total}`);
    console.log(`New Bookings: ${students.length}`);
    console.log('\n📍 PICKUP LOCATIONS:');
    students.forEach((s, i) => {
      console.log(`${i + 1}. ${s.full_name} - ${s.pickup.name} (Seat ${availableSeats[i]})`);
    });

    console.log('\n🎯 NEXT STEP:');
    console.log('Login ke driver app dengan:');
    console.log('Phone: 085213947740');
    console.log('Password: driver123');
    console.log('\nLalu buka travel "Padang → Bonjol" untuk melihat map!\n');

    await db.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await db.end();
    process.exit(1);
  }
}

createBookingsForStudents();
