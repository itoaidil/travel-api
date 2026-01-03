const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'turntable.proxy.rlwy.net',
  user: 'root',
  password: 'zJRybpszurLxJoXAqLBvaBijPvYpMKNA',
  database: 'railway',
  port: 31765
};

async function checkUser() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to Railway MySQL\n');
    
    const email = 'a@gmail.com';
    
    // Check di table customers
    console.log('🔍 Checking CUSTOMERS table:');
    const [customers] = await connection.query(
      'SELECT id, full_name, email, phone, is_active FROM customers WHERE email = ?',
      [email]
    );
    console.table(customers);
    
    // Check di table student_auth
    console.log('\n🔍 Checking STUDENT_AUTH table:');
    const [studentAuth] = await connection.query(
      'SELECT id, email, student_id, is_active FROM student_auth WHERE email = ?',
      [email]
    );
    console.table(studentAuth);
    
    // Check di table users
    console.log('\n🔍 Checking USERS table:');
    const [users] = await connection.query(
      'SELECT id, username, email, user_type, is_active FROM users WHERE email = ?',
      [email]
    );
    console.table(users);
    
    console.log('\n📊 SUMMARY:');
    console.log(`Customers: ${customers.length} record(s)`);
    console.log(`Student Auth: ${studentAuth.length} record(s)`);
    console.log(`Users: ${users.length} record(s)`);
    
    if (customers.length === 0 && studentAuth.length === 0 && users.length === 0) {
      console.log('\n❌ User a@gmail.com NOT FOUND in any table!');
      console.log('\n💡 Untuk login, gunakan salah satu:');
      console.log('   - Customer: daftar dulu via /api/customer/register');
      console.log('   - Student: gunakan student1@mail.com / student123');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkUser();
