const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * DANA DISBURSEMENT CALLBACK ROUTES
 * 
 * Handle notifications from DANA when disbursement (transfer to bank) is completed or failed
 * 
 * Endpoints:
 * - POST /api/withdrawal/dana-disburse-callback
 * - POST /api/withdrawal/dana-disburse-inquiry (optional - for manual check)
 */

/**
 * Verify DANA signature for security
 * DANA will send signature in header: X-DANA-Signature
 */
function verifyDanaSignature(payload, signature) {
  try {
    // Get DANA webhook secret from env
    const webhookSecret = process.env.DANA_WEBHOOK_SECRET || '';
    
    if (!webhookSecret) {
      console.warn('⚠️ DANA_WEBHOOK_SECRET not configured');
      return true; // Allow in development/testing
    }

    // Create HMAC SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('❌ Error verifying DANA signature:', error);
    return false;
  }
}

/**
 * Map DANA status to our internal status
 */
function mapDanaStatus(danaStatus) {
  const statusMap = {
    'SUCCESS': 'completed',
    'COMPLETED': 'completed',
    'FAILED': 'rejected',
    'REJECTED': 'rejected',
    'PENDING': 'processing',
    'PROCESSING': 'processing'
  };
  
  return statusMap[danaStatus?.toUpperCase()] || 'processing';
}

/**
 * POST /api/withdrawal/dana-disburse-callback
 * Webhook endpoint untuk menerima notification dari DANA
 * 
 * DANA akan kirim POST request ke endpoint ini ketika:
 * - Transfer ke bank driver BERHASIL
 * - Transfer ke bank driver GAGAL
 * - Transfer masih PROCESSING
 * 
 * Expected Payload dari DANA:
 * {
 *   "partnerReferenceNo": "WD-123", // withdrawal ID dari kita
 *   "amount": {
 *     "value": "500000.00",
 *     "currency": "IDR"
 *   },
 *   "disbursementStatus": "SUCCESS" | "FAILED" | "PROCESSING",
 *   "disbursementId": "DANA-DISB-123456", // DANA transaction ID
 *   "disbursementTime": "2026-02-12T10:30:00+07:00",
 *   "additionalInfo": {
 *     "accountNo": "1234567890",
 *     "accountName": "Budi Santoso",
 *     "bankCode": "014" // BCA
 *   },
 *   "failureReason": "Invalid account number" // if failed
 * }
 */
router.post('/dana-disburse-callback', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('📨 DANA Disbursement Callback Received:', JSON.stringify(req.body, null, 2));
    
    const db = req.db;
    
    // Get signature from header
    const signature = req.headers['x-dana-signature'] || req.headers['X-DANA-Signature'];
    
    // Verify signature (optional in sandbox)
    if (process.env.NODE_ENV === 'production' && signature) {
      const isValid = verifyDanaSignature(req.body, signature);
      if (!isValid) {
        console.error('❌ Invalid DANA signature');
        return res.status(401).json({
          responseCode: '4010000',
          responseMessage: 'Invalid signature'
        });
      }
    }
    
    // Extract data from DANA payload
    const {
      partnerReferenceNo,    // Our withdrawal ID
      amount,
      disbursementStatus,    // SUCCESS, FAILED, PROCESSING
      disbursementId,        // DANA transaction ID
      disbursementTime,
      additionalInfo,
      failureReason
    } = req.body;

    // Validate required fields
    if (!partnerReferenceNo || !disbursementStatus) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        responseCode: '4000000',
        responseMessage: 'Missing required fields'
      });
    }

    // Extract withdrawal ID from partnerReferenceNo
    // Format: WD-123 or just 123
    const withdrawalId = partnerReferenceNo.toString().replace(/^WD-/, '');

    console.log(`🔍 Processing withdrawal ID: ${withdrawalId}, DANA Status: ${disbursementStatus}`);

    // Check if withdrawal exists
    const [withdrawals] = await db.query(
      'SELECT * FROM driver_withdrawals WHERE id = ?',
      [withdrawalId]
    );

    if (!withdrawals || withdrawals.length === 0) {
      console.error(`❌ Withdrawal not found: ${withdrawalId}`);
      return res.status(404).json({
        responseCode: '4040000',
        responseMessage: 'Withdrawal not found'
      });
    }

    const withdrawal = withdrawals[0];

    // Map DANA status to our internal status
    const newStatus = mapDanaStatus(disbursementStatus);
    
    console.log(`📊 Status mapping: ${disbursementStatus} → ${newStatus}`);

    // Prepare update query based on status
    let updateQuery = '';
    let updateParams = [];

    if (newStatus === 'completed') {
      // Transfer successful
      updateQuery = `
        UPDATE driver_withdrawals 
        SET 
          status = 'completed',
          transaction_id = ?,
          completed_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `;
      updateParams = [disbursementId, withdrawalId];
      
      console.log(`✅ Withdrawal ${withdrawalId} marked as COMPLETED`);
      console.log(`   Amount: ${amount?.value || withdrawal.withdrawal_amount}`);
      console.log(`   DANA Transaction ID: ${disbursementId}`);
      console.log(`   Account: ${additionalInfo?.accountNo || 'N/A'}`);

    } else if (newStatus === 'rejected') {
      // Transfer failed
      const errorMessage = failureReason || 'Transfer failed from DANA';
      
      updateQuery = `
        UPDATE driver_withdrawals 
        SET 
          status = 'rejected',
          rejection_reason = ?,
          processed_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `;
      updateParams = [errorMessage, withdrawalId];
      
      console.log(`❌ Withdrawal ${withdrawalId} marked as REJECTED`);
      console.log(`   Reason: ${errorMessage}`);

    } else if (newStatus === 'processing') {
      // Still processing
      updateQuery = `
        UPDATE driver_withdrawals 
        SET 
          status = 'processing',
          transaction_id = ?,
          processed_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `;
      updateParams = [disbursementId || null, withdrawalId];
      
      console.log(`⏳ Withdrawal ${withdrawalId} is PROCESSING`);
    }

    // Execute update
    await db.query(updateQuery, updateParams);

    // Log activity
    await db.query(
      `INSERT INTO withdrawal_logs (withdrawal_id, status, dana_response, created_at) 
       VALUES (?, ?, ?, NOW())`,
      [withdrawalId, disbursementStatus, JSON.stringify(req.body)]
    ).catch(err => {
      // Log table might not exist, ignore error
      console.warn('⚠️ Could not log to withdrawal_logs:', err.message);
    });

    const processingTime = Date.now() - startTime;
    console.log(`✅ DANA callback processed successfully in ${processingTime}ms`);

    // Send success response to DANA
    return res.json({
      responseCode: '2000000',
      responseMessage: 'Successful',
      partnerReferenceNo: partnerReferenceNo
    });

  } catch (error) {
    console.error('❌ Error processing DANA callback:', error);
    
    // Send error response to DANA
    return res.status(500).json({
      responseCode: '5000000',
      responseMessage: 'Internal server error'
    });
  }
});

/**
 * POST /api/withdrawal/dana-disburse-inquiry
 * Manual inquiry endpoint to check disbursement status from DANA
 * 
 * Use this for:
 * - Manual status check
 * - Reconciliation
 * - Debugging
 */
router.post('/dana-disburse-inquiry', async (req, res) => {
  try {
    const { withdrawal_id } = req.body;
    const db = req.db;

    if (!withdrawal_id) {
      return res.status(400).json({
        success: false,
        message: 'withdrawal_id is required'
      });
    }

    // Get withdrawal details
    const [withdrawals] = await db.query(
      'SELECT * FROM driver_withdrawals WHERE id = ?',
      [withdrawal_id]
    );

    if (!withdrawals || withdrawals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    const withdrawal = withdrawals[0];

    // In real implementation, you would call DANA API here
    // const danaResponse = await callDanaInquiryAPI(withdrawal.id);
    
    // For now, return current status
    return res.json({
      success: true,
      data: {
        withdrawal_id: withdrawal.id,
        status: withdrawal.status,
        amount: withdrawal.withdrawal_amount,
        transaction_id: withdrawal.transaction_id,
        requested_at: withdrawal.requested_at,
        completed_at: withdrawal.completed_at,
        rejection_reason: withdrawal.rejection_reason
      }
    });

  } catch (error) {
    console.error('❌ Error in DANA inquiry:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to inquiry disbursement status',
      error: error.message
    });
  }
});

/**
 * GET /api/withdrawal/dana-webhook-test
 * Test endpoint to verify webhook is accessible
 */
router.get('/dana-webhook-test', (req, res) => {
  res.json({
    success: true,
    message: 'DANA webhook endpoint is accessible',
    endpoint: '/api/withdrawal/dana-disburse-callback',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// DUMMY ENDPOINTS (Required by DANA but not used - we use Midtrans for payment)
// ============================================================================

/**
 * POST /api/withdrawal/dana-payment-callback
 * Finish Payment URL (MANDATORY in DANA dashboard)
 * Not used because we use Midtrans for payment, but DANA requires this field
 */
router.post('/dana-payment-callback', async (req, res) => {
  console.log('⚠️  DANA Payment Callback received (not used - we use Midtrans):', req.body);
  
  // Return success response to satisfy DANA
  res.json({
    responseCode: '2000000',
    responseMessage: 'Successful',
    referenceNo: req.body.referenceNo || 'N/A'
  });
});

/**
 * GET /api/withdrawal/dana-redirect
 * Finish Redirect URL (MANDATORY in DANA dashboard)
 * Not used because we don't redirect users, but DANA requires this field
 */
router.get('/dana-redirect', (req, res) => {
  console.log('⚠️  DANA Redirect accessed (not used):', req.query);
  
  // Return simple success page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Complete</title>
      <style>
        body { font-family: Arial; text-align: center; padding: 50px; }
        .success { color: #28a745; font-size: 24px; margin: 20px; }
      </style>
    </head>
    <body>
      <div class="success">✓ Payment Complete</div>
      <p>You can close this page.</p>
    </body>
    </html>
  `);
});

module.exports = router;
