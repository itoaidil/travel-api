const axios = require('axios');

const baseUrl = 'https://travel-api-production-23ae.up.railway.app/api';

async function wakeDatabase() {
  console.log('🔄 MEMBANGUNKAN DATABASE RAILWAY...\n');
  console.log('Mencoba beberapa endpoint untuk wake-up database:\n');
  
  // Array of simple endpoints to try
  const endpoints = [
    { method: 'GET', url: `${baseUrl}/student/departure-cities`, desc: 'Departure Cities' },
    { method: 'POST', url: `${baseUrl}/customer/login`, desc: 'Customer Login', data: { email: 'test@test.com', password: '123456' } },
    { method: 'POST', url: `${baseUrl}/student/login`, desc: 'Student Login', data: { email: 'student1@example.com', password: 'password123' } },
  ];
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    console.log(`${i + 1}. Testing: ${endpoint.desc}`);
    console.log(`   URL: ${endpoint.url}`);
    
    try {
      const config = {
        timeout: 20000, // 20 seconds
        headers: { 'Content-Type': 'application/json' }
      };
      
      const startTime = Date.now();
      let response;
      
      if (endpoint.method === 'POST') {
        response = await axios.post(endpoint.url, endpoint.data, config);
      } else {
        response = await axios.get(endpoint.url, config);
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ Response dalam ${duration}ms`);
      console.log(`   Status: ${response.status}`);
      
      if (response.data) {
        if (response.data.success) {
          console.log(`   ✅ Success: ${response.data.message || 'OK'}`);
        } else {
          console.log(`   ⚠️  Response: ${JSON.stringify(response.data).substring(0, 100)}`);
        }
      }
      
      successCount++;
      
    } catch (error) {
      const duration = error.config ? Date.now() - Date.now() : 0;
      
      if (error.code === 'ECONNABORTED') {
        console.log(`   ❌ TIMEOUT setelah 20 detik`);
        console.log(`   ⚠️  Database masih sleeping atau query terlalu lambat`);
        failCount++;
      } else if (error.response) {
        console.log(`   ⚠️  Status: ${error.response.status}`);
        console.log(`   Message: ${error.response.data?.message || JSON.stringify(error.response.data).substring(0, 100)}`);
        // Status selain timeout dianggap "berhasil bangunkan server"
        successCount++;
      } else {
        console.log(`   ❌ Error: ${error.message}`);
        failCount++;
      }
    }
    
    console.log('');
    
    // Wait 2 seconds between requests
    if (i < endpoints.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 HASIL DIAGNOSA:');
  console.log('='.repeat(60));
  console.log(`✅ Berhasil response: ${successCount}/${endpoints.length}`);
  console.log(`❌ Timeout/Error: ${failCount}/${endpoints.length}`);
  
  if (failCount === endpoints.length) {
    console.log('\n❌ DATABASE MASIH MATI!');
    console.log('\n💡 SOLUSI:');
    console.log('   1. Buka Railway Dashboard: https://railway.app/');
    console.log('   2. Pilih project: travel-api-production');
    console.log('   3. Klik tab "Deployments"');
    console.log('   4. Klik "Redeploy" atau "Restart"');
    console.log('   5. Tunggu 2-3 menit');
    console.log('   6. Jalankan script ini lagi: node wake_railway_db.js');
  } else if (failCount > 0) {
    console.log('\n⚠️  DATABASE TERBANGUN TAPI MASIH LAMBAT');
    console.log('   Tunggu 1-2 menit lagi, database sedang warming up...');
    console.log('   Coba login di Flutter app sekarang!');
  } else {
    console.log('\n✅ DATABASE AKTIF DAN SIAP!');
    console.log('   Silakan coba login di Flutter app sekarang!');
  }
  
  console.log('='.repeat(60) + '\n');
}

// Run the wake-up process
wakeDatabase().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
