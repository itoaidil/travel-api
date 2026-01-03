const axios = require('axios');

async function testLogin() {
  console.log('Testing Railway API Login...\n');
  
  const url = 'https://travel-api-production-23ae.up.railway.app/api/customer/login';
  const data = {
    email: 'a@gmail.com',
    password: '123456'
  };
  
  console.log('URL:', url);
  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('\nSending request...\n');
  
  try {
    const startTime = Date.now();
    const response = await axios.post(url, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    const endTime = Date.now();
    
    console.log('✅ SUCCESS');
    console.log('Status:', response.status);
    console.log('Time:', (endTime - startTime), 'ms');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ ERROR');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else if (error.request) {
      console.log('No response received');
      console.log('Error:', error.message);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testLogin();
