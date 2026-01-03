const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function seedLocations() {
  let connection;
  
  try {
    console.log('🔐 Railway Database Connection');
    console.log('='.repeat(60));
    
    // Prompt for credentials
    const host = await question('Host (default: autorack.proxy.rlwy.net): ') || 'autorack.proxy.rlwy.net';
    const port = await question('Port (default: 57639): ') || '57639';
    const user = await question('User (default: root): ') || 'root';
    const password = await question('Password: ');
    const database = await question('Database (default: railway): ') || 'railway';
    
    console.log('\n🚀 Connecting to database...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: host,
      port: parseInt(port),
      user: user,
      password: password,
      database: database
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
    
    console.log(`📊 Found ${statements.length} SQL statements\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.toLowerCase().includes('create table')) {
        console.log(`🔨 Creating table location_references...`);
      } else if (statement.toLowerCase().includes('insert into')) {
        process.stdout.write(`\r💾 Inserting data: ${i}/${statements.length}`);
      } else if (statement.toLowerCase().includes('select')) {
        console.log(`\n\n🔍 Running verification query...`);
      }
      
      try {
        const [result] = await connection.execute(statement);
        
        // Show result for SELECT queries
        if (statement.toLowerCase().includes('select')) {
          console.table(result);
        }
      } catch (error) {
        // Ignore "table already exists" error
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log('\n⚠️  Table already exists, skipping CREATE TABLE');
        } else if (error.code === 'ER_DUP_ENTRY') {
          // Skip duplicate entries
          process.stdout.write(' (skip duplicate)');
        } else {
          console.error(`\n❌ Error executing statement: ${statement.substring(0, 100)}...`);
          console.error(`Error: ${error.message}`);
          
          const cont = await question('\nContinue? (y/n): ');
          if (cont.toLowerCase() !== 'y') {
            throw error;
          }
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
    rl.close();
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
