const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Railway Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'autorack.proxy.rlwy.net',
  port: process.env.DB_PORT || 57918,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'WjuSbXCaXMqjJYmPkDzCvfTtLPILnwvn',
  database: process.env.DB_NAME || 'railway',
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    console.log('🔌 Connecting to Railway MySQL database...');
    console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   Database: ${dbConfig.database}`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!\n');

    // Read migration file
    const migrationFile = path.join(__dirname, 'migrations', 'enhance_po_tables.sql');
    console.log('📄 Reading migration file:', migrationFile);
    
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
    console.log(`   File size: ${migrationSQL.length} characters\n`);

    // Execute migration
    console.log('🚀 Executing migration...');
    console.log('=' .repeat(60));
    
    const [results] = await connection.query(migrationSQL);
    
    console.log('=' .repeat(60));
    console.log('✅ Migration executed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Enhanced pos table with business info, verification fields');
    console.log('   - Enhanced vehicles table with documents, maintenance fields');
    console.log('   - Enhanced drivers table with complete profile fields');
    console.log('   - Enhanced vehicle_schedules with pricing info');
    console.log('   - Created route_prices table for dynamic pricing');
    console.log('   - Created vehicle_documents table');
    console.log('   - Created driver_documents table');
    console.log('   - Created po_notifications table');
    console.log('   - Created po_settlements table');
    console.log('   - Created vehicle_maintenance_logs table');
    
    console.log('\n✨ All PO tables are now ready for PO Partner App!');

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    
    if (error.sqlMessage) {
      console.error('SQL Error:', error.sqlMessage);
      console.error('SQL State:', error.sqlState);
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

// Run migration
console.log('\n🔧 PO Tables Migration Script');
console.log('=' .repeat(60));
runMigration();
