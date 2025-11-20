/**
 * Midtrans Payment Gateway Configuration
 * 
 * Sandbox Mode:
 * - Untuk testing, tidak ada transaksi uang sungguhan
 * - Gunakan kartu test: 4811 1111 1111 1114
 * - Semua transaksi sandbox berhasil secara otomatis
 * 
 * Production Mode:
 * - Aktifkan setelah verifikasi dokumen lengkap
 * - Gunakan Server Key dan Client Key production dari dashboard Midtrans
 */

const midtransClient = require('midtrans-client');

// Mode: 'sandbox' atau 'production'
const MIDTRANS_ENVIRONMENT = process.env.MIDTRANS_ENVIRONMENT || 'sandbox';

// Kredensial dari Midtrans Dashboard
// TODO: Daftar di https://dashboard.midtrans.com/ untuk mendapatkan kredensial
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || 'YOUR_SANDBOX_SERVER_KEY';
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || 'YOUR_SANDBOX_CLIENT_KEY';

// Inisialisasi Snap API (untuk pembayaran)
const snap = new midtransClient.Snap({
  isProduction: MIDTRANS_ENVIRONMENT === 'production',
  serverKey: MIDTRANS_SERVER_KEY,
  clientKey: MIDTRANS_CLIENT_KEY,
});

// Inisialisasi Core API (untuk cek status transaksi)
const coreApi = new midtransClient.CoreApi({
  isProduction: MIDTRANS_ENVIRONMENT === 'production',
  serverKey: MIDTRANS_SERVER_KEY,
  clientKey: MIDTRANS_CLIENT_KEY,
});

/**
 * Generate Snap Token untuk pembayaran
 * @param {Object} transactionDetails - Detail transaksi
 * @returns {Promise<Object>} Response dengan token
 */
async function createTransaction(transactionDetails) {
  try {
    const transaction = await snap.createTransaction(transactionDetails);
    return {
      success: true,
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    };
  } catch (error) {
    console.error('Error creating Midtrans transaction:', error);
    return {
      success: false,
      message: error.message || 'Failed to create transaction',
    };
  }
}

/**
 * Cek status transaksi
 * @param {string} orderId - ID pesanan
 * @returns {Promise<Object>} Status transaksi
 */
async function checkTransactionStatus(orderId) {
  try {
    const statusResponse = await coreApi.transaction.status(orderId);
    return {
      success: true,
      data: statusResponse,
    };
  } catch (error) {
    console.error('Error checking transaction status:', error);
    return {
      success: false,
      message: error.message || 'Failed to check transaction status',
    };
  }
}

/**
 * Verifikasi signature dari Midtrans notification
 * @param {Object} notification - Data notifikasi dari Midtrans
 * @returns {boolean} Valid atau tidak
 */
function verifySignature(notification) {
  const crypto = require('crypto');
  const { order_id, status_code, gross_amount } = notification;
  const signature_key = notification.signature_key;

  const serverKey = MIDTRANS_SERVER_KEY;
  const hash = crypto
    .createHash('sha512')
    .update(order_id + status_code + gross_amount + serverKey)
    .digest('hex');

  return hash === signature_key;
}

module.exports = {
  snap,
  coreApi,
  createTransaction,
  checkTransactionStatus,
  verifySignature,
  MIDTRANS_ENVIRONMENT,
  MIDTRANS_CLIENT_KEY,
};
