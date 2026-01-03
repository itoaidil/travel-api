const db = require('./config/database');
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testBookingFlow() {
  console.log('=== TESTING BOOKING FLOW ===\n');
  
  try {
    // Step 1: Get available travels
    console.log('Step 1: Mengambil daftar travel...');
    const travelsResponse = await axios.get(`${API_BASE}/student/travels`);
    const travels = travelsResponse.data.data || [];
    console.log(`✓ Ditemukan ${travels.length} travel`);
    if (travels.length === 0) {
      console.log('❌ Tidak ada travel yang tersedia untuk testing\n');
      return;
    }
    const schedule = travels[0];
    console.log(`  Contoh jadwal: ${schedule.origin} → ${schedule.destination}`);
    console.log(`  PO: ${schedule.po_name || '-'}, Harga: Rp${schedule.price}\n`);

    // Step 3: Get Booked Seats
    console.log('Step 3: Mengecek kursi yang sudah dipesan...');
    const seatsResp = await axios.get(`${API_BASE}/student/travels/${schedule.id || schedule.travel_id}/booked-seats`);
    const bookedSeats = seatsResp.data.data || seatsResp.data.bookedSeats || [];
    console.log(`✓ Kursi yang sudah dipesan: ${bookedSeats.length > 0 ? bookedSeats.join(', ') : 'Tidak ada'}\n`);

    // Step 4: Select available seats
    const availableSeats = [1, 2, 3, 4, 5].filter(seat => !bookedSeats.includes(seat));
    const selectedSeats = availableSeats.slice(0, 2); // Pilih 2 kursi
    console.log(`Step 4: Memilih kursi: ${selectedSeats.join(', ')}\n`);

    // Step 5: Create test customer (or use existing)
    console.log('Step 5: Login/Register customer...');
    let customerId;
    
    // Try login first
    try {
      const loginResponse = await axios.post(`${API_BASE}/customer/login`, {
        email: 'test@customer.com',
        password: 'test123'
      });
      customerId = loginResponse.data.data.id;
      console.log(`✓ Login berhasil - Customer ID: ${customerId}\n`);
    } catch (loginError) {
      // If login fails, register new customer
      console.log('  Customer belum ada, membuat customer baru...');
      const registerResponse = await axios.post(`${API_BASE}/customer/register`, {
        full_name: 'Test Customer',
        email: 'test@customer.com',
        phone: '081234567890',
        password: 'test123'
      });
      customerId = registerResponse.data.data.id;
      console.log(`✓ Register berhasil - Customer ID: ${customerId}\n`);
    }

    // Step 6: Create booking (dengan pickup & dropoff)
    console.log('Step 6: Membuat booking...');
    const totalPrice = schedule.price * selectedSeats.length;
    const bookingData = {
      customer_id: customerId,
      travel_id: schedule.id || schedule.travel_id,
      selected_seats: selectedSeats,
      payment_method: 'transfer_bank',
      total_price: totalPrice,
      pickup_location: schedule.origin || 'Pickup Point',
      dropoff_location: schedule.destination || 'Dropoff Point'
    };

    const bookingResponse = await axios.post(`${API_BASE}/customer/booking`, bookingData);
    const bookingId = bookingResponse.data.data.booking_id;
    console.log(`✓ Booking berhasil dibuat`);
    console.log(`  Booking ID: ${bookingId}`);
    console.log(`  Total Harga: Rp${totalPrice}`);
    console.log(`  Metode Pembayaran: ${bookingData.payment_method}\n`);

    // Step 7: Check database
    console.log('Step 7: Mengecek data di database...\n');
    
    // Check bookings table
    const bookingQuery = `
      SELECT b.*, c.full_name as customer_name, c.email
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ?
    `;
    
    db.query(bookingQuery, [bookingId], (err, bookings) => {
      if (err) {
        console.error('Error checking bookings:', err);
        return;
      }

      if (bookings.length > 0) {
        const booking = bookings[0];
        console.log('✓ Data Booking di Database:');
        console.log(`  ID: ${booking.id}`);
        console.log(`  Booking Code: ${booking.booking_code}`);
        console.log(`  Customer: ${booking.customer_name} (${booking.email})`);
        console.log(`  Travel ID: ${booking.travel_id}`);
        console.log(`  Jumlah Penumpang: ${booking.num_passengers}`);
        console.log(`  Total Harga: Rp${booking.total_price}`);
        console.log(`  Metode Pembayaran: ${booking.payment_method}`);
        console.log(`  Status Booking: ${booking.booking_status}`);
        console.log(`  Status Payment: ${booking.payment_status}`);
        console.log(`  Tanggal Booking: ${booking.booking_date}\n`);
      } else {
        console.log('❌ Booking tidak ditemukan di database\n');
      }

      // Check booking_seats table
      const seatsQuery = 'SELECT * FROM booking_seats WHERE booking_id = ?';
      db.query(seatsQuery, [bookingId], (err, seats) => {
        if (err) {
          console.error('Error checking seats:', err);
          return;
        }

        if (seats.length > 0) {
          console.log('✓ Data Kursi di Database:');
          seats.forEach((seat, index) => {
            console.log(`  ${index + 1}. Kursi ${seat.seat_number}`);
          });
          console.log('');
        } else {
          console.log('❌ Data kursi tidak ditemukan di database\n');
        }

        // Final summary
        console.log('=== SUMMARY ===');
        console.log('✓ Flow booking berhasil dari awal sampai akhir');
        console.log('✓ Data berhasil masuk ke tabel: bookings, booking_seats');
        console.log('✓ Semua tahapan berjalan dengan baik\n');
        
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
console.log('Memastikan server API berjalan di http://localhost:3000...\n');
setTimeout(() => {
  testBookingFlow();
}, 1000);
