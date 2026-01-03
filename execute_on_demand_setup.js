const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// Railway MySQL credentials
const dbConfig = {
  host: 'mysql.railway.internal',
  user: 'root',
  password: process.env.MYSQLPASSWORD || '',
  database: 'railway',
  port: 3306,
  multipleStatements: true // Allow multiple SQL statements
};

async function executeSQLFile() {
  console.log('🚀 ON-DEMAND DRIVER SYSTEM - DATABASE SETUP');
  console.log('=' .repeat(70));
  console.log('📅 Date:', new Date().toLocaleString('id-ID'));
  console.log('🔗 Host:', dbConfig.host);
  console.log('💾 Database:', dbConfig.database);
  console.log('');
  
  let connection;
  
  try {
    // Step 1: Read SQL file
    console.log('📖 Reading SQL file...');
    const sqlFilePath = path.join(__dirname, 'setup_on_demand_complete.sql');
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    console.log(`✅ SQL file loaded: ${sqlContent.length} characters\n`);
    
    // Step 2: Connect to database
    console.log('🔌 Connecting to Railway MySQL...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!\n');
    
    // Step 3: Execute SQL (split by statement if needed)
    console.log('⚙️  Executing SQL statements...');
    console.log('─'.repeat(70));
    
    // Split SQL by CREATE/INSERT/ALTER statements for better logging
    const statements = sqlContent.split(/(?=CREATE|INSERT|ALTER|DROP)/i).filter(s => s.trim());
    
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt || stmt.startsWith('--')) continue;
      
      try {
        // Extract table/operation name for logging
        const match = stmt.match(/(?:CREATE|INSERT|ALTER|DROP)\s+(?:TABLE|OR REPLACE VIEW|INDEX|INTO)?\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([a-z_]+)/i);
        const objectName = match ? match[1] : `statement_${i+1}`;
        
        await connection.query(stmt);
        console.log(`✅ ${objectName}`);
        successCount++;
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ALREADY' || error.code === 'ER_DUP_KEYNAME') {
          console.log(`⏭️  ${error.message.split(':')[0]} (skipped)`);
          skipCount++;
        } else {
          throw error;
        }
      }
    }
    
    console.log('─'.repeat(70));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Successfully executed: ${successCount} statements`);
    console.log(`   ⏭️  Skipped (already exists): ${skipCount} statements`);
    console.log('');
    
    // Step 4: Verify tables created
    console.log('🔍 Verifying tables...');
    const [tables] = await connection.query("SHOW TABLES LIKE '%demand%' OR SHOW TABLES LIKE 'service_types' OR SHOW TABLES LIKE 'commission%' OR SHOW TABLES LIKE 'discount%'");
    
    if (tables.length > 0) {
      console.log('\n📋 ON-DEMAND SYSTEM TABLES:');
      tables.forEach((row, index) => {
        const tableName = Object.values(row)[0];
        console.log(`   ${index + 1}. ${tableName}`);
      });
    }
    
    // Step 5: Check service types
    console.log('\n🎯 Service Types:');
    const [services] = await connection.query('SELECT service_code, service_name, allowed_vehicle_types FROM service_types');
    console.table(services);
    
    // Step 6: Check commission configs
    console.log('💰 Commission Configs:');
    const [commissions] = await connection.query(`
      SELECT cc.party_type, cc.party_name, cc.commission_value, cc.commission_type, st.service_name
      FROM commission_configs cc
      JOIN service_types st ON cc.service_type_id = st.id
      LIMIT 10
    `);
    console.table(commissions);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ DATABASE SETUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\n📝 Next Steps:');
    console.log('   1. Build API endpoints for driver registration');
    console.log('   2. Build location tracking API');
    console.log('   3. Build trip request/management APIs');
    console.log('   4. Setup WebSocket for real-time updates');
    console.log('   5. Update Flutter apps (driver & customer)\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\n📋 Error Details:');
    console.error('   Code:', error.code);
    console.error('   SQL State:', error.sqlState);
    if (error.sql) {
      console.error('   Failed SQL:', error.sql.substring(0, 200) + '...');
    }
    
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check if MYSQLPASSWORD env var is set');
    console.error('   2. Run this on Railway deployment:');
    console.error('      railway run node execute_on_demand_setup.js');
    console.error('   3. Or deploy and check logs:');
    console.error('      railway logs');
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed.\n');
    }
  }
}

// Run the setup
executeSQLFile();
