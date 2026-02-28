/**
 * DANA Disbursement Service
 * Handles communication with DANA API for bank transfers
 * Using manual HTTP approach (no external compilation required)
 */

const axios = require('axios');
const crypto = require('crypto');

function getWibTimestamp() {
  const now = new Date();
  const wibMs = now.getTime() + (7 * 60 * 60 * 1000);
  const wibDate = new Date(wibMs);
  return `${wibDate.toISOString().replace('Z', '')}+07:00`;
}

function getDanaPartnerId() {
  return process.env.DANA_PARTNER_ID || process.env.DANA_CLIENT_ID || '';
}

function getDanaBearerToken() {
  return process.env.DANA_ACCESS_TOKEN || process.env.DANA_BEARER_TOKEN || '';
}

function buildExternalId() {
  const seed = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return seed.slice(0, 18);
}

function normalizePrivateKey(rawKey) {
  if (!rawKey) {
    return '';
  }

  let key = rawKey.trim();

  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }

  if (!key.includes('-----BEGIN') && /^[A-Za-z0-9+/=\r\n]+$/.test(key)) {
    try {
      const decoded = Buffer.from(key.replace(/\s+/g, ''), 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN')) {
        key = decoded;
      } else {
        // Raw base64 DER format - wrap with PEM headers
        const base64Content = key.replace(/\s+/g, '');
        const lines = base64Content.match(/.{1,64}/g) || [];
        key = '-----BEGIN RSA PRIVATE KEY-----\n' + 
              lines.join('\n') + '\n' +
              '-----END RSA PRIVATE KEY-----';
      }
    } catch (error) {
      console.warn('⚠️  Unable to process DANA private key, wrapping as PEM');
      const base64Content = key.replace(/\s+/g, '');
      const lines = base64Content.match(/.{1,64}/g) || [];
      key = '-----BEGIN RSA PRIVATE KEY-----\n' + 
            lines.join('\n') + '\n' +
            '-----END RSA PRIVATE KEY-----';
    }
  }

  return key;
}

function generateDanaSignature(method, relativePath, body, timestamp) {
  const privateKey = normalizePrivateKey(process.env.DANA_PRIVATE_KEY || '');
  if (!privateKey) {
    return process.env.DANA_SIGNATURE || '';
  }

  // SNAP format: METHOD:RELATIVE_PATH:SHA256(body):X-TIMESTAMP
  const bodyHash = crypto.createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex')
    .toLowerCase();
  
  const stringToSign = `${method}:${relativePath}:${bodyHash}:${timestamp}`;
  
  console.log('🔐 Generating SNAP signature:');
  console.log('  Method:', method);
  console.log('  Path:', relativePath);
  console.log('  Body SHA256:', bodyHash);
  console.log('  Timestamp:', timestamp);
  console.log('  String to sign:', stringToSign);
  
  try {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(stringToSign);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');
    console.log('✅ Signature generated:', signature.substring(0, 30) + '...');
    return signature;
  } catch (error) {
    console.error('❌ Failed to generate DANA signature:', error.message);
    return process.env.DANA_SIGNATURE || '';
  }
}

function buildDanaHeaders(method, relativePath, body) {
  const partnerId = getDanaPartnerId();
  const bearerToken = getDanaBearerToken();
  const timestamp = getWibTimestamp();
  const externalId = buildExternalId();
  const signature = generateDanaSignature(method, relativePath, body, timestamp);

  if (!partnerId) {
    throw new Error('DANA_PARTNER_ID / DANA_CLIENT_ID is required');
  }

  if (!signature) {
    throw new Error('DANA signature is missing. Set DANA_PRIVATE_KEY or DANA_SIGNATURE');
  }

  const headers = {
    'X-TIMESTAMP': timestamp,
    'X-SIGNATURE': signature,
    'X-PARTNER-ID': partnerId,
    'X-EXTERNAL-ID': externalId,
    'CHANNEL-ID': process.env.DANA_CHANNEL_ID || '00001',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  // Bearer token is OPTIONAL (only for symmetric signature)
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
    console.log('🔑 Using symmetric signature with Bearer token');
  } else {
    console.log('🔑 Using asymmetric signature (SNAP default)');
  }

  return headers;
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
    
    // Format phone to strict 628xxxx format (DANA requirement)
    let customerNumber = (withdrawalData.phone || '').toString().replace(/\D/g, '');
    if (customerNumber.startsWith('0')) {
      customerNumber = `62${customerNumber.slice(1)}`;
    } else if (customerNumber.startsWith('8')) {
      customerNumber = `62${customerNumber}`;
    }

    if (!/^628\d+$/.test(customerNumber)) {
      throw new Error(`Invalid driver phone format for customerNumber: ${withdrawalData.phone}`);
    }

    console.log(`📱 Using DANA customerNumber from driver phone: ${customerNumber}`);
    
    // Format amount with .00 (DANA requirement)
    const amountValue = parseFloat(withdrawalData.amount).toFixed(2);
    
    // Prepare disbursement payload - UPDATED per DANA IT requirements
    const payload = {
      partnerReferenceNo: partnerReferenceNo,
      customerNumber: customerNumber,  // ✅ Phone format 628xxxx
      beneficiaryAccountNumber: '2460888509', // ✅ DANA testing account
      beneficiaryBankCode: beneficiaryBankCode,
      amount: {
        value: amountValue,  // ✅ With .00 format
        currency: 'IDR'
      },
      additionalInfo: {
        fundType: 'MERCHANT_WITHDRAW_FOR_CORPORATE',
        needNotify: true
      }
      // ✅ Removed: beneficiaryAccountName, description
    };

    // DANA API endpoint - latest spec
    // POST /v1.0/emoney/transfer-bank.htm
    let baseUrl = process.env.DANA_BASE_URL || 'https://api.sandbox.dana.id';
    baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    // Per DANA IT: use v1.0 as primary
    const endpoints = [
      { url: `${baseUrl}/v1.0/emoney/transfer-bank.htm`, path: '/v1.0/emoney/transfer-bank.htm' },
      { url: `${baseUrl}/v1/emoney/transfer-bank.htm`, path: '/v1/emoney/transfer-bank.htm' }
    ];

    // Build headers with SNAP signature
    const method = 'POST';
    const relativePath = endpoints[0].path; // Use v1.0 for signature
    const headers = buildDanaHeaders(method, relativePath, payload);

    let response = null;
    let lastError = null;

    console.log(`💸 Trying DANA transfer-to-bank with ${endpoints.length} endpoint variants...`);
    console.log(`📋 Request Body:`, JSON.stringify(payload, null, 2));

    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log(`🔄 Trying endpoint: ${endpoint.url}`);
        
        response = await axios.post(
          endpoint.url,
          payload,
          {
            headers: {
              ...headers
            },
            timeout: 8000
          }
        );

        console.log(`✅ Success with endpoint: ${endpoint.url}`);
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
        console.warn(`⚠️  Endpoint ${endpoint.url} failed: HTTP ${err.response?.status}`);
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

    // DANA response format (latest):
    // 2004300 => Successful
    // 2024300 => Request In Progress
    const responseCode = response.data?.responseCode;
    const responseMessage = response.data?.responseMessage;
    const danaData = response.data?.data || response.data;
    
    console.log(`📊 DANA Response Code: ${responseCode}`);
    console.log(`📌 DANA Message: ${responseMessage}`);
    console.log(`📦 DANA Data:`, JSON.stringify(danaData, null, 2));

    // Extract transaction reference from top-level response
    const disbursementId = danaData?.disbursementId || 
                          danaData?.referenceNo || 
                          danaData?.transactionId ||
                          response.data?.referenceNo ||
                          null;
    
    let status = 'FAILED';
    if (responseCode === '2004300') {
      status = 'SUCCESS';
    } else if (responseCode === '2024300') {
      status = 'PROCESSING';
    } else if (danaData?.status) {
      status = danaData.status;
    }

    console.log(`✅ DANA Request Accepted:`, {
      responseCode: responseCode,
      disbursementId: disbursementId || '(awaiting callback)',
      status: status
    });

    return {
      success: responseCode === '2004300' || responseCode === '2024300',
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

    // DANA API endpoint for status check
    // https://github.com/dana-id/dana-node - POST /v1.0/emoney/transfer-bank-status.htm
    let baseUrl = process.env.DANA_BASE_URL || 'https://api.sandbox.dana.id';
    baseUrl = baseUrl.replace(/\/$/, '');
    
    const endpoints = [
      { url: `${baseUrl}/v1.0/emoney/transfer-bank-status.htm`, path: '/v1.0/emoney/transfer-bank-status.htm' },
      { url: `${baseUrl}/v1/emoney/transfer-bank-status.htm`, path: '/v1/emoney/transfer-bank-status.htm' }
    ];

    // Build request payload
    const payload = { partnerReferenceNo: partnerReferenceNo };
    
    // Build headers with SNAP signature
    const method = 'POST';
    const relativePath = endpoints[0].path;
    const headers = buildDanaHeaders(method, relativePath, payload);

    let response = null;
    let lastError = null;

    console.log(`🔄 Checking status with ${endpoints.length} endpoint variants...`);

    // Try each endpoint
    for (const endpoint of endpoints) {
      try {
        console.log(`🔄 Trying endpoint: ${endpoint.url}`);
        
        response = await axios.post(
          endpoint.url,
          payload,
          {
            headers: {
              ...headers
            },
            timeout: 8000
          }
        );

        console.log(`✅ Success with endpoint: ${endpoint.url}`);
        break;
        
      } catch (err) {
        lastError = err;
        console.warn(`⚠️  Endpoint ${endpoint.url} failed: HTTP ${err.response?.status}`);
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
