/**
 * DANA Disbursement Service
 * Handles communication with DANA API for bank transfers
 * Using manual HTTP approach (no external compilation required)
 */

const axios = require('axios');

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
 * Create disbursement to bank account via DANA
 * @param {Object} withdrawalData - Withdrawal information
 * @returns {Promise<Object>} DANA disbursement response
 */
async function createDisbursement(withdrawalData) {
  try {
    console.log('🚀 Creating DANA disbursement for withdrawal:', withdrawalData.id);

    // Generate unique reference number
    const partnerReferenceNo = `WD-${withdrawalData.id}-${Date.now()}`;
    
    // Prepare disbursement payload
    const payload = {
      partnerReferenceNo: partnerReferenceNo,
      amount: {
        value: withdrawalData.amount.toString(),
        currency: 'IDR'
      },
      beneficiaryAccountNo: withdrawalData.bank_account_number,
      beneficiaryAccountName: withdrawalData.bank_account_holder,
      beneficiaryBankCode: getBankCode(withdrawalData.bank_name),
      description: `Withdrawal Driver ${withdrawalData.driver_id}`
    };

    // Basic auth with Client ID and Secret
    const credentials = Buffer.from(
      `${process.env.DANA_CLIENT_ID}:${process.env.DANA_CLIENT_SECRET}`
    ).toString('base64');

    // DANA API endpoint - try multiple formats
    let baseUrl = process.env.DANA_BASE_URL || 'https://api.sandbox.dana.id';
    baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    // Try disbursements endpoint, fallback to transfer-to-bank
    const endpoints = [
      `${baseUrl}/v1/disbursements`,
      `${baseUrl}/v1/transfer-to-bank/transfer`,
      `${baseUrl}/transfer-to-bank`,
      `${baseUrl}/disbursements`
    ];

    let response = null;
    let lastError = null;

    console.log(`💸 Trying DANA disbursement with ${endpoints.length} endpoint variants...`);
    console.log(`📋 Request Body:`, JSON.stringify(payload, null, 2));

    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log(`🔄 Trying endpoint: ${endpoint}`);
        
        response = await axios.post(
          endpoint,
          payload,
          {
            headers: {
              'Authorization': `Basic ${credentials}`,
              'X-DANA-Merchant-Id': process.env.DANA_MERCHANT_ID,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        console.log(`✅ Success with endpoint: ${endpoint}`);
        console.log(`📝 DANA Response:`, JSON.stringify(response.data, null, 2));
        break; // Success! Stop trying other endpoints
        
      } catch (err) {
        lastError = err;
        console.warn(`⚠️  Endpoint ${endpoint} failed: HTTP ${err.response?.status}`);
        // Continue to next endpoint
      }
    }

    // If all endpoints failed
    if (!response) {
      throw lastError;
    }

    return {
      success: true,
      disbursementId: response.data.disbursementId || response.data.referenceNo,
      partnerReferenceNo: partnerReferenceNo,
      status: response.data.status || 'PROCESSING',
      response: response.data
    };

  } catch (error) {
    const errorMsg = error.response?.data?.message || error.response?.data?.responseMessage || error.message;
    const statusCode = error.response?.status;
    
    console.error(`❌ DANA disbursement failed (HTTP ${statusCode}): ${errorMsg}`);
    console.error(`📋 Error Details:`, {
      statusCode: error.response?.status,
      errorData: error.response?.data,
      message: error.message,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers ? Object.keys(error.config.headers) : []
      }
    });
    
    return {
      success: false,
      error: errorMsg,
      errorCode: error.response?.data?.code || statusCode || 'UNKNOWN_ERROR',
      statusCode: statusCode
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
    console.log('🔍 Checking DANA disbursement status:', partnerReferenceNo);

    // Basic auth
    const credentials = Buffer.from(
      `${process.env.DANA_CLIENT_ID}:${process.env.DANA_CLIENT_SECRET}`
    ).toString('base64');

    // DANA API endpoint
    let baseUrl = process.env.DANA_BASE_URL || 'https://api.sandbox.dana.id';
    baseUrl = baseUrl.replace(/\/$/, '');
    
    const endpoint = `${baseUrl}/v1/disbursements/${partnerReferenceNo}`;

    const response = await axios.get(
      endpoint,
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'X-DANA-Merchant-Id': process.env.DANA_MERCHANT_ID,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ DANA status retrieved successfully');

    return {
      success: true,
      status: response.data.status || response.data.disbursementStatus,
      data: response.data
    };

  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    const statusCode = error.response?.status;
    
    console.error(`❌ Failed to check DANA status (HTTP ${statusCode}): ${errorMsg}`);
    
    return {
      success: false,
      error: errorMsg,
      statusCode: statusCode
    };
  }
}

module.exports = {
  createDisbursement,
  checkDisbursementStatus,
  getBankCode
};
