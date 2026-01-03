const db = require('./config/database');

console.log('=== CHECKING BOOKING ID 19 DETAILS ===\n');

const query = `
  SELECT 
    b.*,
    c.full_name as customer_name,
    c.email
  FROM bookings b
  LEFT JOIN customers c ON b.customer_id = c.id
  WHERE b.id = 19
`;

db.query(query, (err, results) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }

  if (results.length === 0) {
    console.log('Booking not found');
    process.exit(0);
  }

  const b = results[0];
  console.log('Booking Details:');
  console.log(`ID: ${b.id}`);
  console.log(`Code: ${b.booking_code}`);
  console.log(`Customer: ${b.customer_name} (${b.email})`);
  console.log(`Travel ID: ${b.travel_id}`);
  console.log(`Pickup Location: ${b.pickup_location || 'NULL'}`);
  console.log(`Dropoff Location: ${b.dropoff_location || 'NULL'}`);
  console.log(`Payment Method: ${b.payment_method}`);
  console.log(`Total Price: Rp${b.total_price}`);
  console.log(`Status: ${b.booking_status} / ${b.payment_status}`);
  
  process.exit(0);
});
