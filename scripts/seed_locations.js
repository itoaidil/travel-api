const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function seedLocations() {
  let connection;
  
  try {
    console.log('🚀 Connecting to database...');
    
    // Create connection - Railway Database
    connection = await mysql.createConnection({
      host: process.env.MYSQLHOST || 'autorack.proxy.rlwy.net',
      port: process.env.MYSQLPORT || 57639,
      user: process.env.MYSQLUSER || 'root',
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE || 'railway'
    });
    
    console.log('✅ Connected to database');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, '../migrations/seed_sumbar_locations.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf-8');
    
    console.log('📄 SQL file loaded');
    
    // Split by semicolon and filter out empty statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.toLowerCase().includes('create table')) {
        console.log(`\n🔨 Creating table location_references...`);
      } else if (statement.toLowerCase().includes('insert into')) {
        process.stdout.write(`\r💾 Inserting data: ${i}/${statements.length}`);
      } else if (statement.toLowerCase().includes('select')) {
        console.log(`\n\n🔍 Running verification query...`);
      }
      
      try {
        const [result] = await connection.execute(statement);
        
        // Show result for SELECT queries
        if (statement.toLowerCase().includes('select')) {
          console.log(result);
        }
      } catch (error) {
        // Ignore "table already exists" error
        if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
          console.error(`\n❌ Error executing statement: ${statement.substring(0, 100)}...`);
          throw error;
        } else {
          console.log('\n⚠️  Table already exists, skipping CREATE TABLE');
        }
      }
    }
    
    console.log('\n\n✅ Migration completed successfully!');
    console.log('📊 Total locations inserted: 155 (7 cities + 148 districts)');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the seeding
seedLocations()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
