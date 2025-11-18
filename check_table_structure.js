const db = require('./config/database');

console.log('=== CHECKING BOOKINGS TABLE STRUCTURE ===\n');

db.query('DESCRIBE bookings', (err, columns) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }

  console.log('Kolom-kolom di tabel bookings:\n');
  columns.forEach(col => {
    console.log(`- ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `Default: ${col.Default}` : ''}`);
  });

  console.log('\n=== CHECKING RECENT BOOKINGS ===\n');
  
  db.query('SELECT * FROM bookings ORDER BY id DESC LIMIT 5', (err, bookings) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }

    console.log(`Ditemukan ${bookings.length} booking terakhir:\n`);
    bookings.forEach((b, i) => {
      console.log(`${i+1}. ID: ${b.id}, Travel ID: ${b.travel_id}`);
      console.log(`   Pickup Point ID: ${b.pickup_point_id || 'NULL'}`);
      console.log(`   Dropoff Location: ${b.dropoff_location || 'NULL'}`);
      console.log(`   Payment Method: ${b.payment_method || 'NULL'}`);
      console.log(`   Total Price: ${b.total_price}`);
      console.log('');
    });

    process.exit(0);
  });
});
