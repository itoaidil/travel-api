const express = require('express');
const router = express.Router();
const db = require('../config/database');
const danaService = require('../services/danaService');

/**
 * ===== DRIVER WITHDRAWAL ENDPOINTS =====
 * 
 * POST /api/driver/withdrawal/request
 * GET /api/driver/withdrawal/requests/:driver_id
 * GET /api/driver/withdrawal/balance/:driver_id
 * 
 * POST /api/admin/withdrawal/list
 * POST /api/admin/withdrawal/:id/approve
 * POST /api/admin/withdrawal/:id/reject
 * POST /api/admin/withdrawal/:id/complete
 */

/**
 * POST /api/driver/withdrawal/request
 * Driver membuat request withdrawal
 * 
 * Body: {
 *   driver_id: 25,
 *   withdrawal_amount: 500000,
 *   bank_name: "BCA",
 *   bank_account_number: "1234567890",
 *   bank_account_holder: "Budi Santoso"
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Withdrawal request submitted successfully",
 *   data: {
 *     id: 1,
 *     driver_id: 25,
 *     withdrawal_amount: 500000,
 *     status: "pending",
 *     requested_at: "2026-02-11T10:30:00Z",
 *     ...
 *   }
 * }
 */
router.post('/request', async (req, res) => {
  const { driver_id, withdrawal_amount, bank_name, bank_account_number, bank_account_holder } = req.body;

  try {
    // Validation
    if (!driver_id || !withdrawal_amount) {
      return res.status(400).json({
        success: false,
        message: 'driver_id and withdrawal_amount are required'
      });
    }

    if (withdrawal_amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal amount must be greater than 0'
      });
    }

    // Check driver exists
    const [drivers] = await db.query(
      'SELECT id, total_earnings, bank_account_number, bank_account_holder, bank_name FROM independent_drivers WHERE id = ?',
      [driver_id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = drivers[0];

    // Calculate available balance (total_earnings - pending withdrawals)
    const [pendingWithdrawals] = await db.query(
      `SELECT COALESCE(SUM(withdrawal_amount), 0) as total_pending 
       FROM driver_withdrawals 
       WHERE driver_id = ? AND status IN ('pending', 'processing')`,
      [driver_id]
    );

    const totalPending = pendingWithdrawals[0].total_pending || 0;
    const availableBalance = (driver.total_earnings || 0) - totalPending;

    if (withdrawal_amount > availableBalance) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance',
        data: {
          total_earnings: driver.total_earnings,
          pending_withdrawals: totalPending,
          available_balance: availableBalance,
          requested_amount: withdrawal_amount
        }
      });
    }

    // Use provided bank details or from driver profile
    const finalBankName = bank_name || driver.bank_name;
    const finalAccountNumber = bank_account_number || driver.bank_account_number;
    const finalAccountHolder = bank_account_holder || driver.bank_account_holder;

    // Validate bank details
    if (!finalBankName || !finalAccountNumber || !finalAccountHolder) {
      return res.status(400).json({
        success: false,
        message: 'Complete bank details are required. Please update your profile with bank information.'
      });
    }

    // Create withdrawal request with status 'processing' (will auto-trigger DANA)
    const [result] = await db.query(
      `INSERT INTO driver_withdrawals 
       (driver_id, withdrawal_amount, bank_name, bank_account_number, bank_account_holder, status, requested_at, processed_at)
       VALUES (?, ?, ?, ?, ?, 'processing', NOW(), NOW())`,
      [driver_id, withdrawal_amount, finalBankName, finalAccountNumber, finalAccountHolder]
    );

    const withdrawalId = result.insertId;

    // Fetch the created withdrawal
    const [newWithdrawal] = await db.query(
      'SELECT * FROM driver_withdrawals WHERE id = ?',
      [withdrawalId]
    );

    console.log(`✅ Withdrawal request created - Driver ${driver_id}, Amount: ${withdrawal_amount} - Auto-triggering DANA transfer...`);

    // ===== AUTO-TRIGGER DANA API (No admin manual approval needed) =====
    danaService.createDisbursement({
      id: withdrawalId,
      driver_id: driver_id,
      amount: withdrawal_amount,
      bank_name: finalBankName,
      bank_account_number: finalAccountNumber,
      bank_account_holder: finalAccountHolder
    }).then(result => {
      if (result.success) {
        console.log(`✅ DANA transfer initiated for withdrawal ${withdrawalId}`);
        // Update dengan DANA tracking info
        db.query(
          `UPDATE driver_withdrawals 
           SET partner_reference_no = ?, 
               dana_disbursement_id = ?,
               dana_status = ?
           WHERE id = ?`,
          [result.partnerReferenceNo, result.disbursementId, result.status, withdrawalId]
        );
      } else {
        console.error(`❌ DANA transfer failed for withdrawal ${withdrawalId}:`, result.error);
        // If DANA fails, store error but keep as processing (can retry later)
        db.query(
          `UPDATE driver_withdrawals 
           SET dana_failure_reason = ?,
               dana_status = 'FAILED_INITIAL'
           WHERE id = ?`,
          [result.error, withdrawalId]
        );
      }
    }).catch(error => {
      console.error(`❌ DANA error for withdrawal ${withdrawalId}:`, error.message);
      db.query(
        'UPDATE driver_withdrawals SET dana_failure_reason = ? WHERE id = ?',
        [error.message, withdrawalId]
      );
    });

    return res.json({
      success: true,
      message: 'Withdrawal request submitted successfully - DANA transfer in progress',
      data: newWithdrawal[0]
    });

  } catch (error) {
    console.error('❌ Error creating withdrawal request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create withdrawal request',
      error: error.message
    });
  }
});

/**
 * GET /api/driver/withdrawal/balance/:driver_id
 * Get driver's earnings balance & withdrawal status
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     total_earnings: 5000000,
 *     pending_withdrawals: 500000,
 *     completed_withdrawals: 2000000,
 *     available_balance: 4500000,
 *     last_withdrawal: { id, amount, status, requested_at }
 *   }
 * }
 */
router.get('/balance/:driver_id', async (req, res) => {
  const { driver_id } = req.params;

  try {
    // Get driver earnings
    const [drivers] = await db.query(
      'SELECT total_earnings FROM independent_drivers WHERE id = ?',
      [driver_id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const totalEarnings = drivers[0].total_earnings || 0;

    // Get pending & processing withdrawals
    const [pendingWithdrawals] = await db.query(
      `SELECT COALESCE(SUM(withdrawal_amount), 0) as total_pending 
       FROM driver_withdrawals 
       WHERE driver_id = ? AND status IN ('pending', 'processing')`,
      [driver_id]
    );

    // Get completed withdrawals
    const [completedWithdrawals] = await db.query(
      `SELECT COALESCE(SUM(withdrawal_amount), 0) as total_completed 
       FROM driver_withdrawals 
       WHERE driver_id = ? AND status = 'completed'`,
      [driver_id]
    );

    // Get last withdrawal request
    const [lastWithdrawal] = await db.query(
      `SELECT id, withdrawal_amount, status, bank_account_number, bank_account_holder, 
              requested_at, processed_at, completed_at 
       FROM driver_withdrawals 
       WHERE driver_id = ? 
       ORDER BY requested_at DESC 
       LIMIT 1`,
      [driver_id]
    );

    const totalPending = pendingWithdrawals[0].total_pending || 0;
    const totalCompleted = completedWithdrawals[0].total_completed || 0;
    const availableBalance = totalEarnings - totalPending;

    return res.json({
      success: true,
      data: {
        total_earnings: parseFloat(totalEarnings),
        pending_withdrawals: parseFloat(totalPending),
        completed_withdrawals: parseFloat(totalCompleted),
        available_balance: parseFloat(availableBalance),
        last_withdrawal: lastWithdrawal.length > 0 ? lastWithdrawal[0] : null
      }
    });

  } catch (error) {
    console.error('❌ Error fetching withdrawal balance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch balance',
      error: error.message
    });
  }
});

/**
 * GET /api/driver/withdrawal/requests/:driver_id
 * Get driver's withdrawal history
 * 
 * Query params:
 * - status: filter by status (pending, processing, completed, rejected)
 * - limit: default 20
 * - offset: default 0
 * 
 * Response:
 * {
 *   success: true,
 *   data: [
 *     {
 *       id: 1,
 *       withdrawal_amount: 500000,
 *       status: "completed",
 *       bank_account_number: "xxxx7890",
 *       requested_at: "2026-02-11T10:30:00Z",
 *       completed_at: "2026-02-11T12:00:00Z"
 *     }
 *   ]
 * }
 */
router.get('/requests/:driver_id', async (req, res) => {
  const { driver_id } = req.params;
  const { status, limit = 20, offset = 0 } = req.query;

  try {
    let query = `
      SELECT 
        id,
        withdrawal_amount,
        status,
        bank_account_number,
        bank_account_holder,
        rejection_reason,
        requested_at,
        processed_at,
        completed_at
      FROM driver_withdrawals
      WHERE driver_id = ?
    `;

    let params = [driver_id];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY requested_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [withdrawals] = await db.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM driver_withdrawals WHERE driver_id = ?';
    let countParams = [driver_id];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const [countResult] = await db.query(countQuery, countParams);
    const totalCount = countResult[0].total;

    // Mask account number for security
    const maskedWithdrawals = withdrawals.map(w => ({
      ...w,
      bank_account_number: w.bank_account_number ? w.bank_account_number.slice(-4).padStart(w.bank_account_number.length, '*') : null
    }));

    return res.json({
      success: true,
      data: maskedWithdrawals,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching withdrawal requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawal requests',
      error: error.message
    });
  }
});

/**
 * ===== ADMIN ENDPOINTS =====
 */

/**
 * GET /api/admin/withdrawal/list
 * Get all withdrawal requests with pagination
 * 
 * Query params:
 * - status: filter by status
 * - limit: default 20
 * - offset: default 0
 * - sort: 'newest' (default) or 'oldest'
 */
router.get('/admin/list', async (req, res) => {
  const { status, limit = 20, offset = 0, sort = 'newest' } = req.query;

  try {
    let query = `
      SELECT 
        dw.id,
        dw.driver_id,
        dw.withdrawal_amount,
        dw.bank_name,
        dw.bank_account_number,
        dw.bank_account_holder,
        dw.status,
        dw.rejection_reason,
        dw.transaction_id,
        dw.requested_at,
        dw.processed_at,
        dw.completed_at,
        id.full_name,
        id.phone,
        id.email
      FROM driver_withdrawals dw
      JOIN independent_drivers id ON dw.driver_id = id.id
      WHERE 1=1
    `;

    let params = [];

    if (status) {
      query += ' AND dw.status = ?';
      params.push(status);
    }

    const sortOrder = sort === 'oldest' ? 'ASC' : 'DESC';
    query += ` ORDER BY dw.requested_at ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [withdrawals] = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM driver_withdrawals WHERE 1=1';
    let countParams = [];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    const [countResult] = await db.query(countQuery, countParams);

    return res.json({
      success: true,
      data: withdrawals,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching withdrawals for admin:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawals',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/withdrawal/:id/approve
 * Admin approve withdrawal request and trigger DANA disbursement
 */
router.post('/admin/:id/approve', async (req, res) => {
  const { id } = req.params;

  try {
    const [withdrawals] = await db.query(
      `SELECT dw.*, id.bank_name, id.bank_account_number, id.bank_account_holder
       FROM driver_withdrawals dw
       LEFT JOIN independent_drivers id ON dw.driver_id = id.id
       WHERE dw.id = ?`,
      [id]
    );

    if (withdrawals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    const withdrawal = withdrawals[0];

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve withdrawal with status '${withdrawal.status}'`
      });
    }

    // Update status to processing
    await db.query(
      'UPDATE driver_withdrawals SET status = "processing", processed_at = NOW() WHERE id = ?',
      [id]
    );

    console.log(`✅ Withdrawal ${id} approved - Triggering DANA disbursement...`);

    // Trigger DANA disbursement (async - don't wait for completion)
    danaService.createDisbursement({
      id: withdrawal.id,
      driver_id: withdrawal.driver_id,
      amount: withdrawal.amount,
      bank_name: withdrawal.bank_name,
      bank_account_number: withdrawal.bank_account_number,
      bank_account_holder: withdrawal.bank_account_holder
    }).then(result => {
      if (result.success) {
        console.log(`✅ DANA disbursement initiated for withdrawal ${id}`);
        // Update dengan DANA tracking info
        db.query(
          `UPDATE driver_withdrawals 
           SET partner_reference_no = ?, 
               dana_disbursement_id = ?,
               dana_status = ?
           WHERE id = ?`,
          [result.partnerReferenceNo, result.disbursementId, result.status, id]
        );
      } else {
        console.error(`❌ DANA disbursement initial call failed for withdrawal ${id}:`, result.error);
        // Keep status as processing - DANA may retry or be manually completed
        // Store failure reason for debugging
        db.query(
          `UPDATE driver_withdrawals 
           SET dana_failure_reason = ?,
               dana_status = 'FAILED_INITIAL'
           WHERE id = ?`,
          [result.error, id]
        );
      }
    }).catch(error => {
      console.error(`❌ DANA disbursement error for withdrawal ${id}:`, error.message);
      // Keep processing status - allow manual intervention
      db.query(
        'UPDATE driver_withdrawals SET dana_failure_reason = ? WHERE id = ?',
        [error.message, id]
      );
    });

    return res.json({
      success: true,
      message: 'Withdrawal approved! DANA disbursement in progress...',
      data: {
        id,
        status: 'processing',
        processed_at: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error approving withdrawal:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve withdrawal',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/withdrawal/:id/complete
 * Admin mark withdrawal as completed
 * 
 * Body: {
 *   transaction_id: "TRX-123456" (optional - bank transfer reference)
 * }
 */
router.post('/admin/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { transaction_id } = req.body;

  try {
    const [withdrawals] = await db.query(
      'SELECT * FROM driver_withdrawals WHERE id = ?',
      [id]
    );

    if (withdrawals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    const withdrawal = withdrawals[0];

    if (withdrawal.status !== 'processing') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete withdrawal with status '${withdrawal.status}'. Must be 'processing'`
      });
    }

    // Update status to completed
    await db.query(
      'UPDATE driver_withdrawals SET status = "completed", completed_at = NOW(), transaction_id = ? WHERE id = ?',
      [transaction_id || null, id]
    );

    console.log(`✅ Withdrawal ${id} completed - Rp ${withdrawal.withdrawal_amount} transferred to ${withdrawal.bank_account_holder}`);

    return res.json({
      success: true,
      message: 'Withdrawal completed successfully',
      data: {
        id,
        status: 'completed',
        completed_at: new Date(),
        transaction_id: transaction_id || null
      }
    });

  } catch (error) {
    console.error('❌ Error completing withdrawal:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete withdrawal',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/withdrawal/:id/reject
 * Admin reject withdrawal request
 * 
 * Body: {
 *   rejection_reason: "Nomor rekening tidak valid"
 * }
 */
router.post('/admin/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;

  try {
    if (!rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'rejection_reason is required'
      });
    }

    const [withdrawals] = await db.query(
      'SELECT * FROM driver_withdrawals WHERE id = ?',
      [id]
    );

    if (withdrawals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    const withdrawal = withdrawals[0];

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject withdrawal with status '${withdrawal.status}'. Only 'pending' can be rejected`
      });
    }

    // Update status to rejected
    await db.query(
      'UPDATE driver_withdrawals SET status = "rejected", rejection_reason = ?, processed_at = NOW() WHERE id = ?',
      [rejection_reason, id]
    );

    console.log(`❌ Withdrawal ${id} rejected - Reason: ${rejection_reason}`);

    return res.json({
      success: true,
      message: 'Withdrawal request rejected',
      data: {
        id,
        status: 'rejected',
        rejection_reason
      }
    });

  } catch (error) {
    console.error('❌ Error rejecting withdrawal:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject withdrawal',
      error: error.message
    });
  }
});

module.exports = router;
