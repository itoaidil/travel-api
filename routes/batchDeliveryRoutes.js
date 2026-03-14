const express = require('express');
const router = express.Router();

/**
 * POST /api/batch-delivery/import
 * Import an array of geocoded addresses into independent_bookings
 * Body: { packages: [{ no, npp, address, lat, lng }], customer_id: 1 }
 */
router.post('/import', async (req, res) => {
  const db = req.db;
  
  if (!db) {
    return res.status(500).json({ success: false, message: 'Database not available' });
  }

  try {
    const { packages, customer_id } = req.body;
    
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid packages data' });
    }
    
    if (!customer_id) {
      return res.status(400).json({ success: false, message: 'Customer ID is required' });
    }

    // Get customer info
    const [customers] = await db.query(
      'SELECT full_name, email, phone FROM customers WHERE id = ?',
      [customer_id]
    );

    const customer = customers[0] || {};
    const customerName = customer.full_name || 'Corporate Batch';
    const customerPhone = customer.phone || '';
    const customerEmail = customer.email || '';

    let successCount = 0;
    const errors = [];
    
    // Default fixed pickup logic for the sender (could be dynamic later)
    const pickupAddress = "Gudang Utama Operasional";
    const pickupLat = "-6.200000"; // Example warehouse lat
    const pickupLng = "106.816666"; // Example warehouse lng

    for (const pkg of packages) {
      try {
        const timestamp = Date.now() + Math.floor(Math.random() * 1000);
        const bookingCode = `BATCH-${pkg.npp || timestamp}`;

        const insertQuery = `
          INSERT INTO independent_bookings (
            booking_code,
            booking_type,
            customer_id,
            customer_name,
            customer_phone,
            customer_email,
            vehicle_type,
            pickup_location,
            pickup_address,
            pickup_lat,
            pickup_lng,
            dropoff_location,
            dropoff_address,
            dropoff_lat,
            dropoff_lng,
            recipient_name,
            recipient_phone,
            recipient_address_detail,
            payment_method,
            payment_status,
            booking_status,
            distance_km,
            total_fare,
            created_at,
            updated_at
          ) VALUES (
            ?, 'cargo', ?, ?, ?, ?, 
            'motorcycle', 'Gudang Pusat', ?, ?, ?, 
            ?, ?, ?, ?, 
            ?, '', '',
            'cash', 'unpaid', 'batch_pending',
            0, 0,
            NOW(), NOW()
          )
        `;
        
        // Use NPP as recipient_name for now if actual name isn't provided
        const recipientName = pkg.npp ? `NPP: ${pkg.npp}` : 'Batch Recipient';
        
        await db.query(insertQuery, [
          bookingCode,
          customer_id,
          customerName,
          customerPhone,
          customerEmail,
          pickupAddress,
          pickupLat,
          pickupLng,
          'Alamat Tujuan', // dropoff_location logic
          pkg.address,
          pkg.lat || null,
          pkg.lng || null,
          recipientName
        ]);
        
        successCount++;
      } catch (err) {
        console.error('Error inserting batch pkg:', err);
        errors.push({ pkg, error: err.message });
      }
    }

    res.json({
      success: true,
      data: {
        total_received: packages.length,
        success_count: successCount,
        error_count: errors.length,
        errors: errors.slice(0, 10) // Return only first 10 errors for brevity
      }
    });

  } catch (error) {
    console.error('Batch import error:', error);
    res.status(500).json({ success: false, message: 'Server error during batch import', error: error.message });
  }
});

module.exports = router;
