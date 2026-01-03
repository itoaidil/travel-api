const db = require('./config/database');

async function checkUsers() {
  try {
    const [users] = await db.query(`
      SELECT 
        u.id, u.username, u.email, u.user_type,
        p.id as po_id, p.po_name,
        SUBSTRING(u.password, 1, 20) as password_sample
      FROM users u
      JOIN po_admins pa ON u.id = pa.user_id  
      JOIN pos p ON pa.po_id = p.id
      WHERE u.is_active = 1
      ORDER BY p.po_name
    `);
    
    console.log('\n=== LOGIN CREDENTIALS ===\n');
    users.forEach(u => {
      console.log(`PO: ${u.po_name}`);
      console.log(`Username: ${u.username}`);
      console.log(`Password: password123`);
      console.log(`Password Hash Sample: ${u.password_sample}...`);
      console.log('---');
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkUsers();
