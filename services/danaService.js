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

    // DANA API endpoint - use correct endpoint path from GitHub docs
    // https://github.com/dana-id/dana-node/docs/disbursement/v1/Apis/DisbursementApi.md
    let baseUrl = process.env.DANA_BASE_URL || 'https://api.sandbox.dana.id';
    baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    // Correct DANA endpoints from official docs:
    // - POST /v1.0/emoney/transfer-bank.htm  (for transfer)
    // - POST /v1.0/emoney/transfer-bank-status.htm (for status)
    const endpoints = [
      `${baseUrl}/v1.0/emoney/transfer-bank.htm`,     // Official endpoint (correct)
      `${baseUrl}/v1/emoney/transfer-bank.htm`,       // Alternative
      `${baseUrl}/v1.0/emoney/transfer-to-bank.htm`,  // Alternative naming
      `${baseUrl}/v1/disbursements`                   // Legacy (from prev attempt)
    ];

    let response = null;
    let lastError = null;

    console.log(`💸 Trying DANA transfer-to-bank with ${endpoints.length} endpoint variants...`);
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
        console.log(`📝 DANA Response Status: ${response.status}`);
        console.log(`📝 DANA Response Headers:`, {
          'content-type': response.headers['content-type'],
          'x-dana-signature': response.headers['x-dana-signature'] ? '***' : 'none'
        });
        console.log(`📝 DANA Response Data:`, JSON.stringify(response.data, null, 2));
        console.log(`📝 Response Keys:`, Object.keys(response.data || {}));
        break; // Success! Stop trying other endpoints
        
      } catch (err) {
        lastError = err;
        console.warn(`⚠️  Endpoint ${endpoint} failed: HTTP ${err.response?.status}`);
        console.warn(`⚠️  Error Response:`, {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: JSON.stringify(err.response?.data, null, 2)
        });
        // Continue to next endpoint
      }
    }

    // If all endpoints failed
    if (!response) {
      throw lastError;
    }

    // Extract disbursement ID from response (check multiple possible field names)
    const disbursementId = response.data?.disbursementId || 
                          response.data?.referenceNo || 
                          response.data?.transactionId ||
                          response.data?.partnerReferenceNo ||
                          null;
    
    const status = response.data?.status || response.data?.disbursementStatus || 'PROCESSING';

    console.log(`🔍 Extracted from DANA response:`, {
      disbursementId: disbursementId,
      status: status,
      rawResponse: response.data
    });

    return {
      success: true,
      disbursementId: disbursementId,
      partnerReferenceNo: partnerReferenceNo,
      status: status,
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

    // DANA API endpoint for status check
    // https://github.com/dana-id/dana-node - POST /v1.0/emoney/transfer-bank-status.htm
    let baseUrl = process.env.DANA_BASE_URL || 'https://api.sandbox.dana.id';
    baseUrl = baseUrl.replace(/\/$/, '');
    
    const endpoints = [
      `${baseUrl}/v1.0/emoney/transfer-bank-status.htm`,  // Official endpoint
      `${baseUrl}/v1/emoney/transfer-bank-status.htm`,    // Alternative
      `${baseUrl}/v1/disbursements/${partnerReferenceNo}` // Legacy
    ];

    let response = null;
    let lastError = null;

    console.log(`🔄 Checking status with ${endpoints.length} endpoint variants...`);

    // Try each endpoint
    for (const endpoint of endpoints) {
      try {
        console.log(`🔄 Trying endpoint: ${endpoint}`);
        
        response = await axios.post(
          endpoint,
          { partnerReferenceNo: partnerReferenceNo },
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
        break;
        
      } catch (err) {
        lastError = err;
        console.warn(`⚠️  Endpoint ${endpoint} failed: HTTP ${err.response?.status}`);
      }
    }

    if (!response) {
      throw lastError;
    }

    console.log('✅ DANA status retrieved successfully');

    return {
      success: true,
      status: response.data.status || response.data.disbursementStatus || response.data.transferStatus,
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
