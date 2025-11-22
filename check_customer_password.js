const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'turntable.proxy.rlwy.net',
  user: 'root',
  password: 'zJRybpszurLxJoXAqLBvaBijPvYpMKNA',
  database: 'railway',
  port: 31765
};

async function checkPassword() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to Railway MySQL\n');
    
    const email = 'a@gmail.com';
    
    console.log('🔍 Checking password for a@gmail.com in CUSTOMERS table:\n');
    const [customers] = await connection.query(
      'SELECT id, full_name, email, password, phone, is_active, created_at FROM customers WHERE email = ?',
      [email]
    );
    
    if (customers.length > 0) {
      const customer = customers[0];
      console.log('📋 Customer Info:');
      console.log(`ID: ${customer.id}`);
      console.log(`Name: ${customer.full_name}`);
      console.log(`Email: ${customer.email}`);
      console.log(`Phone: ${customer.phone}`);
      console.log(`Active: ${customer.is_active}`);
      console.log(`Created: ${customer.created_at}`);
      console.log(`\n🔐 Password Hash: ${customer.password.substring(0, 60)}...`);
      console.log(`Hash Type: ${customer.password.startsWith('$2') ? 'bcrypt' : 'unknown'}`);
      
      console.log('\n💡 LOGIN INFO:');
      console.log('   Endpoint: POST /api/customer/login');
      console.log('   Email: a@gmail.com');
      console.log('   Password: [password yang Anda gunakan saat register]');
      console.log('   Password di-hash dengan bcrypt, gunakan password asli saat login');
    } else {
      console.log('❌ Customer not found!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkPassword();
