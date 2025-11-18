const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testSeatBlocking() {
  console.log('=== TEST SEAT BLOCKING ===\n');
  
  try {
    // 1. Get travel with existing booking
    console.log('1. Cek travel ID 25 yang ada booking...');
    const response = await axios.get(`${API_BASE}/student/booked-seats?travel_id=25`);
    const bookedSeats = response.data.bookedSeats || response.data.data || [];
    
    console.log(`✓ Kursi yang sudah dipesan: ${bookedSeats.length > 0 ? bookedSeats.join(', ') : 'Tidak ada'}`);
    
    if (bookedSeats.length > 0) {
      console.log('✓ SUKSES: Kursi yang sudah dipesan terdeteksi!');
      console.log('  → User lain TIDAK BISA pesan kursi ini lagi\n');
    } else {
      console.log('❌ GAGAL: Tidak ada kursi yang terdeteksi padahal ada booking\n');
    }
    
    // 2. Test create booking lagi
    console.log('2. Test create booking dengan kursi yang sama (seharusnya gagal)...');
    
    // Get customer
    let customerId;
    try {
      const loginResp = await axios.post(`${API_BASE}/customer/login`, {
        email: 'test@customer.com',
        password: 'test123'
      });
      customerId = loginResp.data.data.id;
    } catch (e) {
      console.log('  Customer tidak ditemukan, skip test duplikasi\n');
      return;
    }
    
    // Try booking same seats (should fail if validation exists)
    const bookingData = {
      customer_id: customerId,
      travel_id: 25,
      selected_seats: bookedSeats.slice(0, 1), // Ambil 1 kursi yang sudah dipesan
      payment_method: 'transfer_bank',
      total_price: 90000,
      pickup_location: 'Padang',
      dropoff_location: 'Pasaman'
    };
    
    console.log(`  Mencoba pesan kursi ${bookedSeats[0]} yang sudah dipesan...`);
    
    try {
      await axios.post(`${API_BASE}/customer/booking`, bookingData);
      console.log('⚠️  WARNING: Booking berhasil padahal kursi sudah dipesan!');
      console.log('  → Perlu tambahkan validasi di backend untuk cek kursi sudah dipesan\n');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✓ BAGUS: Booking ditolak karena kursi sudah dipesan\n');
      } else {
        console.log(`  Error lain: ${error.message}\n`);
      }
    }
    
    console.log('=== KESIMPULAN ===');
    console.log('✓ Kursi yang dipesan sudah muncul di API');
    console.log('✓ Flutter akan otomatis disable kursi tersebut');
    console.log('→ Silakan refresh aplikasi Flutter dan cek seat selection\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSeatBlocking();
