const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'travel_booking',
    multipleStatements: true
  });

  try {
    console.log('Running customer migrations...');

    // Create customers table
    const customersSQL = fs.readFileSync(
      path.join(__dirname, 'create_customers_table.sql'),
      'utf8'
    );
    await connection.query(customersSQL);
    console.log('✓ Customers table created');

    // Create booking_seats table
    const bookingSeatsSQL = fs.readFileSync(
      path.join(__dirname, 'create_booking_seats_table.sql'),
      'utf8'
    );
    await connection.query(bookingSeatsSQL);
    console.log('✓ Booking seats table created');

    console.log('\nAll migrations completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await connection.end();
  }
}

runMigrations();
