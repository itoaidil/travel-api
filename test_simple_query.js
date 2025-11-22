const axios = require('axios');

async function testSimpleQuery() {
  console.log('🧪 Testing simple database query...\n');
  
  // Test endpoint that doesn't involve bcrypt (simpler query)
  const tests = [
    {
      name: 'Health Check',
      url: 'https://travel-api-production-23ae.up.railway.app',
      method: 'GET'
    },
    {
      name: 'Get All POs (simple SELECT)',
      url: 'https://travel-api-production-23ae.up.railway.app/api/po/all',
      method: 'GET'
    },
    {
      name: 'Customer Register (INSERT)',
      url: 'https://travel-api-production-23ae.up.railway.app/api/customer/register',
      method: 'POST',
      data: {
        full_name: 'Test User ' + Date.now(),
        email: 'test' + Date.now() + '@test.com',
        phone: '08123456789',
        password: '123456'
      }
    }
  ];
  
  for (const test of tests) {
    console.log(`\n📍 ${test.name}`);
    console.log(`   URL: ${test.url}`);
    
    try {
      const config = {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      };
      
      const startTime = Date.now();
      let response;
      
      if (test.method === 'POST') {
        response = await axios.post(test.url, test.data, config);
      } else {
        response = await axios.get(test.url, config);
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ Success in ${duration}ms`);
      console.log(`   Status: ${response.status}`);
      
      if (response.data) {
        const preview = JSON.stringify(response.data).substring(0, 150);
        console.log(`   Data: ${preview}${preview.length >= 150 ? '...' : ''}`);
      }
      
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.log(`   ❌ TIMEOUT (15s)`);
      } else if (error.response) {
        console.log(`   ⚠️  Status: ${error.response.status}`);
        const msg = error.response.data?.message || JSON.stringify(error.response.data).substring(0, 100);
        console.log(`   Message: ${msg}`);
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('💡 KESIMPULAN:');
  console.log('   Jika semua timeout = Database query hanging');
  console.log('   Jika ada yang berhasil = Login endpoint specific issue');
  console.log('='.repeat(60));
}

testSimpleQuery();
