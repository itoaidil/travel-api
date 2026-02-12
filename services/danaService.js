/**
 * DANA Disbursement Service
 * Handles communication with DANA API for bank transfers
 */

const axios = require('axios');
const crypto = require('crypto');

/**
 * Get OAuth access token from DANA
 */
async function getDanaAccessToken() {
  try {
    const credentials = Buffer.from(
      `${process.env.DANA_CLIENT_ID}:${process.env.DANA_CLIENT_SECRET}`
    ).toString('base64');

    const response = await axios.post(
      `${process.env.DANA_BASE_URL}/v1/oauth/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('❌ Failed to get DANA access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with DANA');
  }
}

/**
 * Map bank names to DANA bank codes
 */
function getBankCode(bankName) {
  const bankCodes = {
    'BRI': '002',
    'Bank BRI': '002',
    'Bank Rakyat Indonesia': '002',
    'Mandiri': '008',
    'Bank Mandiri': '008',
    'BNI': '009',
    'Bank BNI': '009',
    'Bank Negara Indonesia': '009',
    'BCA': '014',
    'Bank BCA': '014',
    'Bank Central Asia': '014',
    'CIMB': '022',
    'CIMB Niaga': '022',
    'Bank CIMB': '022',
    'BTPN': '213',
    'Bank BTPN': '213',
    'BSI': '451',
    'Bank Syariah Indonesia': '451',
    'BankSyariah': '451'
  };

  // Try exact match first
  if (bankCodes[bankName]) {
    return bankCodes[bankName];
  }

  // Try case-insensitive match
  const lowerBankName = bankName.toLowerCase();
  for (const [key, code] of Object.entries(bankCodes)) {
    if (key.toLowerCase() === lowerBankName) {
      return code;
    }
  }

  // If not found, return default (BCA)
  console.warn(`⚠️  Bank code not found for: ${bankName}, using default (BCA)`);
  return '014';
}

/**
 * Generate signature for DANA request
 */
function generateSignature(payload, timestamp) {
  const stringToSign = `${timestamp}:${JSON.stringify(payload)}`;
  return crypto
    .createHmac('sha256', process.env.DANA_CLIENT_SECRET)
    .update(stringToSign)
    .digest('hex');
}

/**
 * Create disbursement to bank account via DANA
 * @param {Object} withdrawalData - Withdrawal information
 * @returns {Promise<Object>} DANA disbursement response
 */
async function createDisbursement(withdrawalData) {
  try {
    console.log('🚀 Creating DANA disbursement for withdrawal:', withdrawalData.id);

    // Get access token
    const accessToken = await getDanaAccessToken();

    // Prepare disbursement payload
    const timestamp = new Date().toISOString();
    const partnerReferenceNo = `WD-${withdrawalData.id}-${Date.now()}`;
    
    const payload = {
      partnerReferenceNo: partnerReferenceNo,
      amount: {
        value: withdrawalData.amount.toString(),
        currency: 'IDR'
      },
      accountNo: withdrawalData.bank_account_number,
      accountName: withdrawalData.bank_account_holder,
      bankCode: getBankCode(withdrawalData.bank_name),
      remarks: `Withdrawal untuk Driver ${withdrawalData.driver_id}`,
      additionalInfo: {
        withdrawalId: withdrawalData.id.toString(),
        driverId: withdrawalData.driver_id.toString()
      }
    };

    // Generate signature
    const signature = generateSignature(payload, timestamp);

    // Call DANA Disbursement API
    const response = await axios.post(
      `${process.env.DANA_BASE_URL}/v1/transfer-to-bank/transfer`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-DANA-Merchant-Id': process.env.DANA_MERCHANT_ID,
          'X-DANA-Timestamp': timestamp,
          'X-DANA-Signature': signature,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ DANA disbursement created:', response.data);

    return {
      success: true,
      disbursementId: response.data.disbursementId || response.data.referenceNo,
      partnerReferenceNo: partnerReferenceNo,
      status: response.data.status || 'PROCESSING',
      response: response.data
    };

  } catch (error) {
    console.error('❌ DANA disbursement failed:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.responseMessage || error.message,
      errorCode: error.response?.data?.responseCode || 'UNKNOWN_ERROR'
    };
  }
}

/**
 * Check disbursement status from DANA
 * @param {string} partnerReferenceNo - Partner reference number
 * @returns {Promise<Object>} Disbursement status
 */
async function checkDisbursementStatus(partnerReferenceNo) {
  try {
    const accessToken = await getDanaAccessToken();
    const timestamp = new Date().toISOString();

    const response = await axios.get(
      `${process.env.DANA_BASE_URL}/v1/transfer-to-bank/status`,
      {
        params: {
          partnerReferenceNo: partnerReferenceNo
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-DANA-Merchant-Id': process.env.DANA_MERCHANT_ID,
          'X-DANA-Timestamp': timestamp,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      status: response.data.disbursementStatus,
      data: response.data
    };

  } catch (error) {
    console.error('❌ Failed to check DANA status:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.responseMessage || error.message
    };
  }
}

module.exports = {
  createDisbursement,
  checkDisbursementStatus,
  getBankCode
};
