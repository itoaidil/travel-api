const axios = require('axios');

async function testEndpoints() {
  const baseUrl = 'https://travel-api-production-23ae.up.railway.app/api';
  
  // Test 1: Server hidup?
  console.log('1️⃣  Testing server root...');
  try {
    const response = await axios.get('https://travel-api-production-23ae.up.railway.app', { timeout: 5000 });
    console.log('   ✅ Server is running');
  } catch (error) {
    if (error.response) {
      console.log('   ✅ Server is running (404 is normal for root)');
    } else {
      console.log('   ❌ Server tidak merespon');
    }
  }
  
  // Test 2: Database connection - cities endpoint (simple SELECT)
  console.log('\n2️⃣  Testing database connection (GET cities)...');
  try {
    const response = await axios.get(`${baseUrl}/customer/cities`, { timeout: 10000 });
    console.log('   ✅ Database connected');
    console.log('   Response:', response.data);
  } catch (error) {
    console.log('   ❌ Database error atau endpoint tidak ada');
    if (error.code === 'ECONNABORTED') {
      console.log('   ⚠️  TIMEOUT - database might be sleeping or dead');
    }
    console.log('   Error:', error.message);
  }
  
  // Test 3: Login endpoint
  console.log('\n3️⃣  Testing login endpoint...');
  try {
    const response = await axios.post(`${baseUrl}/customer/login`, {
      email: 'a@gmail.com',
      password: '123456'
    }, { timeout: 10000 });
    console.log('   ✅ Login successful');
    console.log('   User:', response.data);
  } catch (error) {
    console.log('   ❌ Login failed');
    if (error.code === 'ECONNABORTED') {
      console.log('   ⚠️  TIMEOUT - database query hanging');
    } else if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Message:', error.response.data);
    }
  }
}

testEndpoints();
