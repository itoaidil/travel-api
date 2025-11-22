const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /api/locations
 * Get all locations for autocomplete
 * 
 * Query params:
 * - search: filter by location name (optional)
 * - type: filter by type (city/regency/district) (optional)
 * - popular: show only popular locations (optional, default: false)
 * - limit: max results (optional, default: 50)
 */
router.get('/', async (req, res) => {
  try {
    const { 
      search = '', 
      type = '', 
      popular = 'false',
      limit = 50 
    } = req.query;
    
    let query = `
      SELECT 
        id,
        name,
        type,
        parent_name,
        is_popular,
        CASE 
          WHEN type = 'city' THEN name
          WHEN type = 'regency' THEN name
          ELSE CONCAT(name, ', ', parent_name)
        END as display_name
      FROM location_references
      WHERE is_active = 1
    `;
    
    const params = [];
    
    // Filter by search term
    if (search) {
      query += ` AND name LIKE ?`;
      params.push(`%${search}%`);
    }
    
    // Filter by type
    if (type && ['city', 'regency', 'district'].includes(type)) {
      query += ` AND type = ?`;
      params.push(type);
    }
    
    // Filter by popular
    if (popular === 'true') {
      query += ` AND is_popular = 1`;
    }
    
    // Order: popular first, then alphabetically
    query += ` ORDER BY is_popular DESC, name ASC`;
    
    // Limit results
    query += ` LIMIT ?`;
    params.push(parseInt(limit));
    
    const [locations] = await db.query(query, params);
    
    res.json({
      success: true,
      count: locations.length,
      data: locations
    });
    
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locations',
      error: error.message
    });
  }
});

/**
 * GET /api/locations/popular
 * Get popular locations only (for quick suggestions)
 */
router.get('/popular', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        type,
        parent_name,
        CASE 
          WHEN type = 'city' THEN name
          ELSE CONCAT(name, ', ', parent_name)
        END as display_name
      FROM location_references
      WHERE is_active = 1 AND is_popular = 1
      ORDER BY 
        CASE type
          WHEN 'city' THEN 1
          WHEN 'regency' THEN 2
          WHEN 'district' THEN 3
        END,
        name ASC
    `;
    
    const [locations] = await db.query(query);
    
    res.json({
      success: true,
      count: locations.length,
      data: locations
    });
    
  } catch (error) {
    console.error('Error fetching popular locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular locations',
      error: error.message
    });
  }
});

/**
 * GET /api/locations/:id
 * Get specific location by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        name,
        type,
        parent_name,
        is_popular,
        is_active,
        created_at,
        updated_at
      FROM location_references
      WHERE id = ?
    `;
    
    const [locations] = await db.query(query, [id]);
    
    if (locations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    
    res.json({
      success: true,
      data: locations[0]
    });
    
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch location',
      error: error.message
    });
  }
});

module.exports = router;
