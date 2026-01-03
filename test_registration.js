const axios = require('axios');

async function testRegistration() {
  console.log('🧪 Testing driver registration API...\n');

  // Test Case 1: Bike (no license required)
  console.log('Test 1: Bike registration (no license/plate)');
  try {
    const response = await axios.post(
      'https://travel-api-production-23ae.up.railway.app/api/on-demand/driver/register',
      {
        user_id: 999,
        full_name: 'Test Rider Bike',
        phone: '08123456789',
        email: 'test.bike@example.com',
        vehicle_type: 'bike',
        vehicle_color: 'red',
        vehicle_year: 2023,
        nik: '1234567890123456',
        bank_name: 'BCA',
        bank_account_number: '1234567890',
        bank_account_holder: 'Test Rider Bike'
      },
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    );
    console.log('✅ Success:', response.data.message);
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }

  console.log('\n---\n');

  // Test Case 2: Motorcycle (license required)
  console.log('Test 2: Motorcycle registration (license required)');
  try {
    const response = await axios.post(
      'https://travel-api-production-23ae.up.railway.app/api/on-demand/driver/register',
      {
        user_id: 998,
        full_name: 'Test Rider Motor',
        phone: '08123456788',
        email: 'test.motor@example.com',
        vehicle_type: 'motorcycle',
        vehicle_plate: 'B1234XYZ',
        vehicle_color: 'black',
        vehicle_year: 2023,
        license_number: 'SIM123456',
        nik: '1234567890123455',
        bank_name: 'BCA',
        bank_account_number: '1234567891',
        bank_account_holder: 'Test Rider Motor'
      }
    );
    console.log('Should fail without license_photo');
    console.log('❌ Error:', response.data);
  } catch (error) {
    console.log('✅ Expected error:', error.response?.data?.message);
  }
}

testRegistration();
