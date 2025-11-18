const db = require('./config/database');

console.log('=== CHECKING BOOKINGS TABLE ===\n');

// Check all bookings
const bookingsQuery = `
  SELECT 
    b.id,
    b.booking_code,
    c.full_name as customer_name,
    c.email,
    b.travel_id,
    b.num_passengers,
    b.total_price,
    b.payment_method,
    b.booking_status,
    b.payment_status,
    b.created_at
  FROM bookings b
  LEFT JOIN customers c ON b.customer_id = c.id
  ORDER BY b.id DESC
  LIMIT 10
`;

db.query(bookingsQuery, (err, bookings) => {
  if (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }

  if (bookings.length === 0) {
    console.log('❌ Tidak ada data booking di database\n');
    process.exit(0);
  }

  console.log(`✓ Ditemukan ${bookings.length} booking terakhir:\n`);
  
  bookings.forEach((booking, index) => {
    console.log(`${index + 1}. Booking ID: ${booking.id}`);
    console.log(`   Booking Code: ${booking.booking_code}`);
    console.log(`   Customer: ${booking.customer_name || 'N/A'} (${booking.email || 'N/A'})`);
    console.log(`   Travel ID: ${booking.travel_id}`);
    console.log(`   Jumlah Penumpang: ${booking.num_passengers}`);
    console.log(`   Total Harga: Rp${booking.total_price}`);
    console.log(`   Metode Pembayaran: ${booking.payment_method}`);
    console.log(`   Status Booking: ${booking.booking_status}`);
    console.log(`   Status Payment: ${booking.payment_status}`);
    console.log(`   Tanggal: ${booking.created_at}`);
    console.log('');

    // Get seats for this booking
    const seatsQuery = 'SELECT seat_number FROM booking_seats WHERE booking_id = ? ORDER BY seat_number';
    db.query(seatsQuery, [booking.id], (err, seats) => {
      if (err) {
        console.error('   Error getting seats:', err);
        return;
      }

      if (seats.length > 0) {
        const seatNumbers = seats.map(s => s.seat_number).join(', ');
        console.log(`   Kursi yang dipesan: ${seatNumbers}\n`);
      }

      if (index === bookings.length - 1) {
        console.log('=== END OF DATA ===\n');
        process.exit(0);
      }
    });
  });
});
