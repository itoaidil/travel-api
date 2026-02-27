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
 * Get DANA customer number (Merchant ID with proper format)
 * DANA requires format: 628xxxxx
 * We use DANA_MERCHANT_ID from env
 */
function getDanaCustomerNumber() {
  let merchantId = process.env.DANA_MERCHANT_ID || '';
  
  // Remove any spaces or special chars
  merchantId = merchantId.replace(/\s+/g, '');
  
  // If doesn't start with 628, it might be just digits - add 628 prefix
  if (!merchantId.startsWith('628')) {
    // Use as-is, DANA might handle it
    console.warn(`⚠️  DANA_MERCHANT_ID doesn't start with 628: ${merchantId}`);
  }
  
  console.log(`📱 Using DANA customerNumber: ${merchantId}`);
  return merchantId;
}

/**
 * Create disbursement to bank account via DANA
 * @param {Object} withdrawalData - Withdrawal information including phone
 * @returns {Promise<Object>} DANA disbursement response
 */
async function createDisbursement(withdrawalData) {
  try {
    console.log('🚀 Creating DANA disbursement for withdrawal:', withdrawalData.id);

    // Generate unique reference number
    const partnerReferenceNo = `WD-${withdrawalData.id}-${Date.now()}`;
    
    // Get bank code for beneficiary
    const beneficiaryBankCode = getBankCode(withdrawalData.bank_name);
    
    // Format phone to 628xxxx format (DANA requirement)
    let customerNumber = withdrawalData.phone || getDanaCustomerNumber();
    if (customerNumber && !customerNumber.startsWith('628')) {
      // Remove leading 0 or + if exists
      customerNumber = customerNumber.replace(/^[0+]/, '');
      // Add 62 prefix
      customerNumber = '62' + customerNumber;
    }
    console.log(`📱 Using DANA customerNumber from phone: ${customerNumber}`);
    
    // Format amount with .00 (DANA requirement)
    const amountValue = parseFloat(withdrawalData.amount).toFixed(2);
    
    // Prepare disbursement payload - UPDATED per DANA IT requirements
    const payload = {
      partnerReferenceNo: partnerReferenceNo,
      customerNumber: customerNumber,  // ✅ Phone format 628xxxx
      beneficiaryAccountNumber: withdrawalData.bank_account_number,
      beneficiaryBankCode: beneficiaryBankCode,
      amount: {
        value: amountValue,  // ✅ With .00 format
        currency: 'IDR'
      }
      // ✅ Removed: beneficiaryAccountName, description, additionalInfo
    };

    // Basic auth with Client ID and Secret
    const credentials = Buffer.from(
      `${process.env.DANA_CLIENT_ID}:${process.env.DANA_CLIENT_SECRET}`
    ).toString('base64');

    // DANA API endpoint - per spec from https://dashboard.dana.id/api-docs-v2/api/disbursement/transfer-to-bank
    let baseUrl = process.env.DANA_BASE_URL || 'https://api.sandbox.dana.id';
    baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    // Use v2 endpoint as per DANA latest spec
    const endpoints = [
      `${baseUrl}/v2/transfer-bank`,                  // v2 endpoint per spec
      `${baseUrl}/v1.0/emoney/transfer-bank.htm`,    // v1.0 endpoint
      `${baseUrl}/v1/emoney/transfer-bank.htm`       // v1 fallback
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

    // DANA response format varies:
    // v1.0 endpoint (with RSA signature):
    // {
    //   "responseCode": "2004300",
    //   "responseMessage": "Success",
    //   "data": {
    //     "referenceNo": "...",
    //     "disbursementId": "...",
    //     "status": "PROCESSING" | "SUCCESS" | "FAILED"
    //   }
    // }
    //
    // v1 endpoint (Basic Auth):
    // Returns 200/201 but `disbursementId` comes from callback webhook
    // Expected: {"responseCode": "2004300"} or empty body with 200

    // Verify success response code
    const responseCode = response.data?.responseCode;
    const responseMessage = response.data?.responseMessage;
    const danaData = response.data?.data || response.data; // data could be nested or flat
    
    console.log(`📊 DANA Response Code: ${responseCode}`);
    console.log(`📌 DANA Message: ${responseMessage}`);
    console.log(`📦 DANA Data:`, JSON.stringify(danaData, null, 2));

    // Extract disbursement ID from DANA response (may be null if from callback)
    const disbursementId = danaData?.disbursementId || 
                          danaData?.referenceNo || 
                          danaData?.transactionId ||
                          null; // ✅ Can be null - will come from webhook callback
    
    const status = danaData?.status || 'PROCESSING';

    console.log(`✅ DANA Request Accepted:`, {
      responseCode: responseCode,
      disbursementId: disbursementId || '(awaiting callback)',
      status: status
    });

    return {
      success: true,
      disbursementId: disbursementId,  // ✅ Can be null - callback will update it
      partnerReferenceNo: partnerReferenceNo,
      status: status,
      responseCode: responseCode,
      response: response.data
    };

  } catch (error) {
    // Extract DANA error message from response
    const danaErrorCode = error.response?.data?.errorCode || error.response?.data?.responseCode;
    const danaErrorMsg = error.response?.data?.errorMessage || 
                        error.response?.data?.responseMessage || 
                        error.response?.data?.message || 
                        error.message;
    const statusCode = error.response?.status;
    
    // For /v1/ endpoints, HTTP 200 is success even if body is empty
    // disbursementId will come from callback webhook
    if (statusCode === 200 || statusCode === 201) {
      console.log(`✅ DANA accepted request (HTTP ${statusCode})`);
      console.log(`📝 Response:`, JSON.stringify(error.response?.data, null, 2));
      
      return {
        success: true,
        disbursementId: null,  // Will come from callback
        partnerReferenceNo: partnerReferenceNo,
        status: 'PROCESSING',
        responseCode: statusCode,
        response: error.response?.data
      };
    }
    
    // For actual errors (4xx, 5xx)
    console.error(`❌ DANA disbursement failed:`, {
      httpStatus: statusCode,
      danaResponseCode: danaErrorCode,
      danaMessage: danaErrorMsg,
      fullResponse: JSON.stringify(error.response?.data, null, 2)
    });
    
    return {
      success: false,
      error: danaErrorMsg || 'DANA API Error',
      errorCode: danaErrorCode || statusCode || 'UNKNOWN_ERROR',
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
