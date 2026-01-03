const db = require('./config/database');

async function checkPoHantar() {
  try {
    // Check if PO Hantar exists
    const [pos] = await db.query(`
      SELECT id, name, address, phone, email 
      FROM pos 
      WHERE name LIKE '%Hantar%'
    `);
    
    console.log('\n=== PO HANTAR DATA ===');
    if (pos.length > 0) {
      console.log(JSON.stringify(pos, null, 2));
      
      // Get admin users for this PO
      const poId = pos[0].id;
      const [admins] = await db.query(`
        SELECT u.id, u.username, u.email, u.phone, u.full_name
        FROM users u
        JOIN po_admins pa ON u.id = pa.user_id
        WHERE pa.po_id = ?
      `, [poId]);
      
      console.log('\n=== ADMIN USERS ===');
      console.log(JSON.stringify(admins, null, 2));
    } else {
      console.log('PO Hantar tidak ditemukan!');
      
      // Show all POs
      const [allPos] = await db.query('SELECT id, name FROM pos ORDER BY id');
      console.log('\n=== ALL POs ===');
      console.log(JSON.stringify(allPos, null, 2));
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkPoHantar();
