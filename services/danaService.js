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

    // Use DANA_BASE_URL from Railway environment variable
    if (!process.env.DANA_BASE_URL) {
      throw new Error('DANA_BASE_URL not configured in environment variables');
    }

    let baseUrl = process.env.DANA_BASE_URL;
    baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash if any
    
    // Determine if base URL already includes /v1
    const hasV1 = baseUrl.includes('/v1');
    
    // Try different OAuth endpoint paths
    const tokenEndpoints = hasV1
      ? [
          `${baseUrl}/oauth/token`,              // If base already has /v1
          `${baseUrl}/auth/token`,               // Alternative
          `${baseUrl}/authorize/token`,          // Another alternative
          `${baseUrl}/oauth2/token`              // OAuth2 variant
        ]
      : [
          `${baseUrl}/v1/oauth/token`,           // Standard (no /v1 in base)
          `${baseUrl}/oauth/token`,              // Without /v1
          `${baseUrl}/v1/auth/token`,            // Alternative name
          `${baseUrl}/v1/authorize/token`        // Another alternative
        ];

    let lastError = null;
    let tokenResponse = null;

    // Try each endpoint until one works
    for (const endpoint of tokenEndpoints) {
      try {
        console.log(`🔐 Attempting DANA OAuth at: ${endpoint}`);

        tokenResponse = await axios.post(
          endpoint,
          'grant_type=client_credentials',
          {
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 5000
          }
        );

        // Success! Log which endpoint worked
        console.log(`✅ DANA OAuth successful via: ${endpoint}`);
        return tokenResponse.data.access_token;

      } catch (error) {
        lastError = error;
        const statusCode = error.response?.status;
        console.log(`   ${statusCode === 404 ? '❌' : '⚠️ '} ${endpoint} - HTTP ${statusCode}`);
        // Continue to next endpoint
      }
    }

    // If all endpoints failed, throw the last error
    if (lastError) {
      console.error('❌ All DANA OAuth endpoints failed. Tried:', tokenEndpoints);
      throw lastError;
    }

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

    // Construct DANA Disbursement endpoint using Railway BASE_URL
    let baseUrl = process.env.DANA_BASE_URL;
    baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash if any
    
    const disbursementEndpoint = baseUrl.includes('/v1')
      ? `${baseUrl}/transfer-to-bank/transfer`
      : `${baseUrl}/v1/transfer-to-bank/transfer`;

    console.log(`💸 Calling DANA transfer endpoint: ${disbursementEndpoint}`);

    // Call DANA Disbursement API
    const response = await axios.post(
      disbursementEndpoint,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-DANA-Merchant-Id': process.env.DANA_MERCHANT_ID,
          'X-DANA-Timestamp': timestamp,
          'X-DANA-Signature': signature,
          'Content-Type': 'application/json'
        },
        timeout: 10000
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

    // Construct DANA status endpoint using Railway BASE_URL
    let baseUrl = process.env.DANA_BASE_URL;
    baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash if any
    
    const statusEndpoint = baseUrl.includes('/v1')
      ? `${baseUrl}/transfer-to-bank/status`
      : `${baseUrl}/v1/transfer-to-bank/status`;

    const response = await axios.get(
      statusEndpoint,
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
