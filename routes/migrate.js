const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

/**
 * POST /api/migrate/locations
 * Run migration for location_references table
 * ⚠️ This endpoint should be protected in production!
 */
router.post('/locations', async (req, res) => {
  let results = {
    success: false,
    message: '',
    stats: {
      created: 0,
      inserted: 0,
      errors: []
    }
  };
  
  try {
    console.log('🚀 Starting migration...');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, '../migrations/seed_sumbar_locations.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf-8');
    
    // Split by semicolon and filter
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        if (statement.toLowerCase().includes('create table')) {
          await db.query(statement);
          results.stats.created++;
          console.log('✅ Table created');
        } else if (statement.toLowerCase().includes('insert into')) {
          await db.query(statement);
          results.stats.inserted++;
        } else if (statement.toLowerCase().includes('select')) {
          // Skip verification queries
          continue;
        }
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log('⚠️  Table already exists');
          results.stats.created++;
        } else if (error.code === 'ER_DUP_ENTRY') {
          // Skip duplicates silently
          results.stats.inserted++;
        } else {
          console.error(`❌ Error: ${error.message}`);
          results.stats.errors.push({
            statement: statement.substring(0, 100),
            error: error.message
          });
        }
      }
    }
    
    results.success = true;
    results.message = 'Migration completed successfully';
    
    console.log('✅ Migration finished!');
    console.log(`📊 Stats: ${results.stats.created} tables, ${results.stats.inserted} inserts, ${results.stats.errors.length} errors`);
    
    res.json(results);
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    results.message = 'Migration failed: ' + error.message;
    res.status(500).json(results);
  }
});

/**
 * GET /api/migrate/status
 * Check if location_references table exists and count records
 */
router.get('/status', async (req, res) => {
  try {
    // Check if table exists
    const [tables] = await db.query("SHOW TABLES LIKE 'location_references'");
    
    if (tables.length === 0) {
      return res.json({
        success: true,
        exists: false,
        message: 'Table location_references does not exist yet'
      });
    }
    
    // Count records
    const [counts] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = 'city' THEN 1 ELSE 0 END) as cities,
        SUM(CASE WHEN type = 'district' THEN 1 ELSE 0 END) as districts,
        SUM(CASE WHEN is_popular = 1 THEN 1 ELSE 0 END) as popular
      FROM location_references
    `);
    
    res.json({
      success: true,
      exists: true,
      data: counts[0]
    });
    
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check status',
      error: error.message
    });
  }
});

module.exports = router;
