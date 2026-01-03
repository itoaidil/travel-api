const axios = require('axios');

const API_URL = 'https://travel-api-production-23ae.up.railway.app/api';

async function testDriverLogin() {
  console.log('🧪 Testing Driver Login...\n');
  
  try {
    // Test Driver 1
    console.log('Testing Driver 1: 081234567811 / driver123');
    const response = await axios.post(`${API_URL}/driver/login`, {
      phone: '081234567811',
      password: 'driver123'
    });
    
    console.log('✅ Login SUCCESS!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('\nToken:', response.data.token.substring(0, 50) + '...');
    
    // Test get schedule
    console.log('\n🧪 Testing Get Schedule...');
    const scheduleResponse = await axios.get(`${API_URL}/driver/schedule/today`, {
      headers: {
        'Authorization': `Bearer ${response.data.token}`
      }
    });
    
    console.log('✅ Schedule GET SUCCESS!');
    console.log('Schedules found:', scheduleResponse.data.data?.length || 0);
    if (scheduleResponse.data.data?.length > 0) {
      console.log('First schedule:', JSON.stringify(scheduleResponse.data.data[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
  }
}

testDriverLogin();
