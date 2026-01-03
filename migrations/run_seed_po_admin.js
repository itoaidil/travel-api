const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Railway MySQL PUBLIC credentials
const dbConfig = {
  host: 'turntable.proxy.rlwy.net',
  user: 'root',
  password: 'zJRybpszurLxJoXAqLBvaBijPvYpMKNA',
  database: 'railway',
  port: 31765
};

async function runSeedPOAdmin() {
  console.log('🌱 Seeding PO Admin data to Railway MySQL...\n');
  console.log('Host:', dbConfig.host);
  console.log('Database:', dbConfig.database);
  console.log('');
  
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to Railway MySQL!\n');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'seed_po_admin.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Remove comments and split by semicolons
    const cleanedSQL = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    const statements = cleanedSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`📄 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments
      if (statement.startsWith('--')) continue;
      
      try {
        const [result] = await connection.query(statement);
        
        // Show result for the final SELECT statement
        if (statement.toLowerCase().includes('select') && i === statements.length - 1) {
          console.log('✅ Seeding completed!\n');
          console.log('📊 Results:');
          console.table(result);
        } else {
          console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
        }
      } catch (err) {
        // Ignore duplicate entry errors
        if (err.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  Statement ${i + 1}: Skipping duplicate entry (already exists)`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, err.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
        }
      }
    }
    
    console.log('\n✅ PO Admin seeding complete!');
    console.log('\n📧 Login credentials:');
    console.log('   Email: admin@po-hantar.com');
    console.log('   Password: admin123');
    console.log('\n🚀 You can now login to PO Partner App');
    
  } catch (error) {
    console.error('❌ Error seeding PO Admin:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
    process.exit(0);
  }
}

runSeedPOAdmin();
