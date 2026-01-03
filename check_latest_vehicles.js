const mysql = require('mysql2/promise');

// Railway MySQL credentials
const dbConfig = {
  host: 'mysql.railway.internal',
  user: 'root',
  password: process.env.MYSQLPASSWORD || '', 
  database: 'railway',
  port: 3306
};

async function checkLatestVehicles() {
  console.log('🔄 Connecting to Railway MySQL Database...\n');
  
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected!\n');
    
    // Get latest 5 vehicles
    console.log('🚗 LATEST 5 VEHICLES:');
    console.log('='.repeat(80));
    const [vehicles] = await connection.query(`
      SELECT 
        v.id, 
        v.vehicle_number, 
        v.plate_number, 
        v.vehicle_type, 
        v.brand, 
        v.model, 
        v.year, 
        v.capacity, 
        v.status,
        v.is_active,
        v.po_id,
        p.po_name,
        v.created_at
      FROM vehicles v 
      LEFT JOIN pos p ON v.po_id = p.id 
      ORDER BY v.id DESC 
      LIMIT 5
    `);
    
    if (vehicles.length === 0) {
      console.log('❌ No vehicles found');
    } else {
      vehicles.forEach((v, index) => {
        console.log(`\n[${index + 1}] Vehicle ID: ${v.id}`);
        console.log(`    Vehicle Number: ${v.vehicle_number || 'NULL'}`);
        console.log(`    Plate Number: ${v.plate_number || 'NULL'}`);
        console.log(`    Type: ${v.vehicle_type || 'NULL'}`);
        console.log(`    Brand: ${v.brand || 'NULL'}`);
        console.log(`    Model: ${v.model || 'NULL'}`);
        console.log(`    Year: ${v.year || 'NULL'}`);
        console.log(`    Capacity: ${v.capacity || 'NULL'}`);
        console.log(`    Status: ${v.status || 'NULL'}`);
        console.log(`    Active: ${v.is_active}`);
        console.log(`    PO: ${v.po_name || 'NULL'} (ID: ${v.po_id})`);
        console.log(`    Created: ${v.created_at}`);
      });
    }
    
    console.log('\n✅ Check completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkLatestVehicles();
