const axios = require('axios');

async function testNewEndpoints() {
  console.log('🧪 Testing new debug endpoints...\n');
  
  const baseUrl = 'https://travel-api-production-23ae.up.railway.app/api/customer';
  
  const tests = [
    {
      name: '1. Database Connection Test',
      method: 'GET',
      url: `${baseUrl}/test-db`,
      desc: 'Simple COUNT query'
    },
    {
      name: '2. Get Customers',
      method: 'GET',
      url: `${baseUrl}/test-customers`,
      desc: 'List customers without password'
    },
    {
      name: '3. Test Login (no bcrypt)',
      method: 'POST',
      url: `${baseUrl}/test-login`,
      data: { email: 'a@gmail.com' },
      desc: 'Find customer by email only'
    }
  ];
  
  for (const test of tests) {
    console.log(`\n${test.name}`);
    console.log(`   ${test.desc}`);
    console.log(`   URL: ${test.url}`);
    
    try {
      const config = {
        timeout: 10000,
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
      
      console.log(`   ✅ Response in ${duration}ms`);
      console.log(`   Status: ${response.status}`);
      
      if (response.data) {
        console.log(`   Data:`, JSON.stringify(response.data, null, 2));
      }
      
    } catch (error) {
      const duration = error.config ? (Date.now() - Date.parse(error.config.headers['x-request-start'] || 0)) : 0;
      
      if (error.code === 'ECONNABORTED') {
        console.log(`   ❌ TIMEOUT (10s) - Query too slow!`);
      } else if (error.response) {
        console.log(`   ⚠️  Status: ${error.response.status}`);
        console.log(`   Data:`, JSON.stringify(error.response.data, null, 2));
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    // Wait 2 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('💡 NEXT STEPS:');
  console.log('   - If all succeed: bcrypt is the problem');
  console.log('   - If still timeout: database queries are too slow');
  console.log('   - Check DBeaver for customer data');
  console.log('='.repeat(60));
}

testNewEndpoints();
