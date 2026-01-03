const mysql = require('mysql2/promise');

async function updateSchemaQuick() {
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
    
    // Step 1: Modify vehicle_type ENUM
    console.log('1️⃣ Adding wheels & skateboard to vehicle_type...');
    try {
      await connection.query(`
        ALTER TABLE independent_drivers 
        MODIFY COLUMN vehicle_type ENUM('bike', 'wheels', 'skateboard', 'motorcycle', 'car', 'truck') NOT NULL
      `);
      console.log('✅ vehicle_type updated\n');
    } catch (err) {
      console.log('⚠️  Error (might already exist):', err.message, '\n');
    }

    // Step 2: Drop unique index on vehicle_plate
    console.log('2️⃣ Updating vehicle_plate to nullable...');
    try {
      await connection.query('ALTER TABLE independent_drivers DROP INDEX vehicle_plate');
      console.log('✅ Dropped old unique index');
    } catch (err) {
      console.log('⚠️  Index not found (ok):', err.message);
    }

    // Step 3: Make vehicle_plate nullable
    try {
      await connection.query(`
        ALTER TABLE independent_drivers 
        MODIFY COLUMN vehicle_plate VARCHAR(20) NULL
      `);
      console.log('✅ vehicle_plate now nullable');
    } catch (err) {
      console.log('❌ Error:', err.message);
    }

    // Step 4: Add unique index back (with NULL support)
    try {
      await connection.query(`
        ALTER TABLE independent_drivers 
        ADD UNIQUE INDEX idx_vehicle_plate (vehicle_plate)
      `);
      console.log('✅ Added new unique index\n');
    } catch (err) {
      console.log('⚠️  Index already exists (ok)\n');
    }

    // Step 5: Drop unique index on license_number
    console.log('3️⃣ Updating license_number to nullable...');
    try {
      await connection.query('ALTER TABLE independent_drivers DROP INDEX license_number');
      console.log('✅ Dropped old unique index');
    } catch (err) {
      console.log('⚠️  Index not found (ok):', err.message);
    }

    // Step 6: Make license_number nullable
    try {
      await connection.query(`
        ALTER TABLE independent_drivers 
        MODIFY COLUMN license_number VARCHAR(50) NULL
      `);
      console.log('✅ license_number now nullable');
    } catch (err) {
      console.log('❌ Error:', err.message);
    }

    // Step 7: Add unique index back
    try {
      await connection.query(`
        ALTER TABLE independent_drivers 
        ADD UNIQUE INDEX idx_license_number (license_number)
      `);
      console.log('✅ Added new unique index\n');
    } catch (err) {
      console.log('⚠️  Index already exists (ok)\n');
    }

    // Verify changes
    console.log('4️⃣ Verifying schema changes...');
    const [columns] = await connection.query(`
      SELECT 
        COLUMN_NAME, 
        COLUMN_TYPE, 
        IS_NULLABLE,
        COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'railway'
        AND TABLE_NAME = 'independent_drivers' 
        AND COLUMN_NAME IN ('vehicle_type', 'vehicle_plate', 'license_number')
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\n📊 Current Schema:');
    console.table(columns);

    await connection.end();
    console.log('\n✅ Schema update complete!');
    
  } catch (error) {
    console.error('\n❌ Connection error:', error.message);
    console.log('\n💡 Solution: Run RAILWAY_SCHEMA_UPDATE.sql manually in Railway console');
  } finally {
    if (connection) await connection.end();
  }
}

updateSchemaQuick();
