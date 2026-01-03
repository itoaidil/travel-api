const db = require('./config/database');

async function checkDatabase() {
  console.log('=== CHECKING DATABASE STRUCTURE ===\n');

  try {
    // Check bookings table structure
    console.log('1. BOOKINGS TABLE:');
    const [structure] = await db.query('DESCRIBE bookings');
    console.table(structure);

    // Check if customer_id column exists in bookings
    console.log('\n2. CHECKING customer_id IN bookings:');
    const [customerIdCheck] = await db.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'bookings' 
      AND COLUMN_NAME = 'customer_id'
    `);
    
    if (customerIdCheck.length === 0) {
      console.log('❌ Column customer_id TIDAK DITEMUKAN di table bookings!');
    } else {
      console.log('✅ Column customer_id ditemukan:');
      console.table(customerIdCheck);
    }

    // Check actual bookings data
    console.log('\n3. SAMPLE BOOKINGS DATA (3 terakhir):');
    const [bookings] = await db.query('SELECT * FROM bookings ORDER BY id DESC LIMIT 3');
    console.table(bookings);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
