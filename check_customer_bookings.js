const db = require('./config/database');

async function checkCustomerBookings() {
  console.log('=== CHECKING CUSTOMER BOOKINGS ===\n');

  const query = `
    SELECT 
      b.id,
      b.travel_id,
      b.num_passengers,
      b.total_price,
      b.payment_method,
      b.booking_status,
      b.payment_status,
      b.booking_date,
      t.departure_time,
      t.origin,
      t.destination,
      p.po_name,
      GROUP_CONCAT(bs.seat_number ORDER BY bs.seat_number) as seats
    FROM bookings b
    JOIN travels t ON b.travel_id = t.id
    JOIN vehicles v ON t.vehicle_id = v.id
    JOIN pos p ON v.po_id = p.id
    LEFT JOIN booking_seats bs ON b.id = bs.booking_id
    WHERE b.customer_id = 1
    GROUP BY b.id
    ORDER BY b.booking_date DESC
  `;

  try {
    const [results] = await db.query(query);

    if (results.length === 0) {
      console.log('❌ Tidak ada booking untuk customer_id=1\n');
    } else {
      console.log(`✅ Ditemukan ${results.length} booking:\n`);
      results.forEach((booking, index) => {
        console.log(`${index + 1}. Booking ID: ${booking.id}`);
        console.log(`   Travel ID: ${booking.travel_id}`);
        console.log(`   PO: ${booking.po_name}`);
        console.log(`   Rute: ${booking.origin} → ${booking.destination}`);
        console.log(`   Keberangkatan: ${booking.departure_time}`);
        console.log(`   Penumpang: ${booking.num_passengers}`);
        console.log(`   Seats: ${booking.seats || 'N/A'}`);
        console.log(`   Total: Rp${booking.total_price}`);
        console.log(`   Payment: ${booking.payment_method}`);
        console.log(`   Booking Status: ${booking.booking_status}`);
        console.log(`   Payment Status: ${booking.payment_status}`);
        console.log(`   Tanggal Booking: ${booking.booking_date}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

checkCustomerBookings();
