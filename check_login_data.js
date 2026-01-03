const db = require('./config/database');
const bcrypt = require('bcrypt');

async function checkLoginData() {
  try {
    // Check all PO admins with their credentials
    const [users] = await db.query(`
      SELECT 
        u.id as user_id,
        u.username,
        u.email,
        u.user_type,
        p.id as po_id,
        p.po_name
      FROM users u
      JOIN po_admins pa ON u.id = pa.user_id
      JOIN pos p ON pa.po_id = p.id
      WHERE u.is_active = 1 AND p.is_active = 1
      ORDER BY p.po_name
    `);
    
    console.log('\n=== PO ADMIN LOGIN DATA ===');
    console.log('Total PO Admins:', users.length);
    console.log('\nLogin Credentials:');
    users.forEach(u => {
      console.log(`\nPO: ${u.po_name} (ID: ${u.po_id})`);
      console.log(`  Username: ${u.username}`);
      console.log(`  Email: ${u.email}`);
      console.log(`  Password: password123 (default)`);
    });
    
    // Check if password123 is hashed correctly
    const testHash = await bcrypt.hash('password123', 10);
    console.log('\n=== PASSWORD INFO ===');
    console.log('Test hash for "password123":', testHash);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkLoginData();
