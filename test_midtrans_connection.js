/**
 * Test Midtrans Configuration
 * 
 * Script sederhana untuk test apakah setup Midtrans sudah benar
 * Tidak perlu database connection
 */

// Load environment variables
require('dotenv').config();

const {
  createTransaction,
  MIDTRANS_ENVIRONMENT,
  MIDTRANS_CLIENT_KEY,
} = require('./config/midtrans');

console.log('=== MIDTRANS SANDBOX TEST ===\n');
console.log('Environment:', MIDTRANS_ENVIRONMENT);
console.log('Client Key:', MIDTRANS_CLIENT_KEY ? MIDTRANS_CLIENT_KEY.substring(0, 20) + '...' : 'NOT SET');
console.log('\n');

// Test data
const testTransaction = {
  transaction_details: {
    order_id: 'TEST-' + Date.now(),
    gross_amount: 100000,
  },
  customer_details: {
    first_name: 'Test User',
    email: 'test@example.com',
    phone: '081234567890',
  },
  item_details: [
    {
      id: 'TEST-ITEM',
      price: 100000,
      quantity: 1,
      name: 'Test Travel Booking',
    },
  ],
};

console.log('Creating test transaction...');
console.log('Order ID:', testTransaction.transaction_details.order_id);
console.log('Amount: Rp', testTransaction.transaction_details.gross_amount);
console.log('\n');

// Test create transaction
createTransaction(testTransaction)
  .then((result) => {
    if (result.success) {
      console.log('✅ SUCCESS! Midtrans is working!');
      console.log('Token:', result.token ? result.token.substring(0, 30) + '...' : 'N/A');
      console.log('Redirect URL:', result.redirect_url);
      console.log('\n');
      console.log('Next Steps:');
      console.log('1. Kredensial Midtrans sudah terhubung');
      console.log('2. Siap untuk test payment dari aplikasi');
      console.log('3. Gunakan kartu test: 4811 1111 1111 1114');
    } else {
      console.log('❌ FAILED:', result.message);
      console.log('\n');
      console.log('Troubleshooting:');
      console.log('1. Pastikan sudah daftar di https://dashboard.sandbox.midtrans.com/');
      console.log('2. Copy Server Key dan Client Key dari dashboard');
      console.log('3. Set di .env atau langsung di config/midtrans.js');
      console.log('4. Restart server setelah update kredensial');
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ ERROR:', error.message);
    console.log('\n');
    console.log('Troubleshooting:');
    console.log('1. Pastikan package midtrans-client sudah terinstall (npm install midtrans-client)');
    console.log('2. Periksa config/midtrans.js');
    process.exit(1);
  });
