const mysql = require('mysql2/promise');

async function addReligionColumn() {
  let connection;
  
  try {
    console.log('🔗 Connecting to Railway database...');
    
    connection = await mysql.createConnection({
      host: 'junction.proxy.rlwy.net',
      port: 28634,
      user: 'root',
      password: 'IeRJGrqTMqnXCESTPHvLYLAlIjuXdYnO',
      database: 'railway',
      connectTimeout: 10000
    });

    console.log('✅ Connected!\n');
    
    // Add religion column
    console.log('Adding religion column...');
    try {
      await connection.query(`
        ALTER TABLE independent_drivers 
        ADD COLUMN religion VARCHAR(50) NULL AFTER gender
      `);
      console.log('✅ religion column added\n');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('⚠️  Column already exists (ok)\n');
      } else {
        throw err;
      }
    }

    // Verify
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'railway'
        AND TABLE_NAME = 'independent_drivers' 
        AND COLUMN_NAME = 'religion'
    `);

    console.log('📊 Verification:');
    console.table(columns);

    await connection.end();
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Solution: Run add_religion_column.sql manually in Railway console');
  } finally {
    if (connection) await connection.end();
  }
}

addReligionColumn();
