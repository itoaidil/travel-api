require('dotenv').config();
const db = require('./config/database');

async function checkOTPTable() {
  try {
    console.log('📊 Checking otp_verifications table...\n');
    
    // Check table structure
    const [structure] = await db.query('DESCRIBE otp_verifications');
    console.log('✅ Table structure:');
    console.table(structure);
    
    // Check data
    const [data] = await db.query('SELECT * FROM otp_verifications LIMIT 10');
    console.log('\n📝 Current data:', data.length, 'rows');
    if (data.length > 0) {
      console.table(data);
    }
    
    // Check customers columns
    const [customerCols] = await db.query("SHOW COLUMNS FROM customers LIKE '%verified%'");
    console.log('\n👤 Customers verification columns:');
    console.table(customerCols);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkOTPTable();
