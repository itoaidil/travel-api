const db = require('./config/database');

async function checkNotifications() {
  try {
    console.log('📋 Checking po_notifications table...\n');
    
    // Check table structure
    const [structure] = await db.query('DESCRIBE po_notifications');
    console.log('Table structure:');
    console.table(structure);
    
    // Check existing notifications
    const [notifications] = await db.query('SELECT * FROM po_notifications ORDER BY created_at DESC LIMIT 5');
    console.log('\n📬 Latest notifications:');
    console.table(notifications);
    
    // Check bookings for PO 67
    const [bookings] = await db.query(`
      SELECT b.id, b.booking_code, b.created_at, t.origin, t.destination, t.po_id, c.full_name
      FROM bookings b
      JOIN travels t ON b.travel_id = t.id
      JOIN customers c ON b.customer_id = c.id
      WHERE t.po_id = 67
      ORDER BY b.created_at DESC
      LIMIT 5
    `);
    console.log('\n🎫 Latest bookings for PO 67:');
    console.table(bookings);
    
    await db.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkNotifications();
