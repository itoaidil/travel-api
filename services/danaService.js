/**
 * DANA Disbursement Service
 * Handles communication with DANA API for bank transfers
 * Using manual HTTP approach (no external compilation required)
 */

const axios = require('axios');
const crypto = require('crypto');

function getWibTimestamp() {
  // Get current local date/time
  const now = new Date();
  
  // Get local timezone offset in milliseconds
  const localOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  
  // Convert to UTC first
  const utcTime = new Date(now.getTime() + localOffsetMs);
  
  // Add 7 hours for Jakarta (GMT+7)
  const wibTime = new Date(utcTime.getTime() + (7 * 60 * 60 * 1000));
  
  // Format as YYYY-MM-DDTHH:mm:ss+07:00 (25 characters exactly)
  // Using UTC methods since wibTime is already in the right epoch offset
  const year = wibTime.getUTCFullYear();
  const month = String(wibTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wibTime.getUTCDate()).padStart(2, '0');
  const hours = String(wibTime.getUTCHours()).padStart(2, '0');
  const minutes = String(wibTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(wibTime.getUTCSeconds()).padStart(2, '0');
  
  const timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
  
  // Verify format (must be exactly 25 characters)
  if (timestamp.length !== 25) {
    console.warn(`⚠️  Timestamp length is ${timestamp.length}, expected 25: ${timestamp}`);
  }
  
  return timestamp;
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

function previewText(value, maxLen = 240) {
  if (value === undefined || value === null) {
    return '';
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

function maskAuthHeader(authHeader) {
  if (!authHeader) {
    return undefined;
  }

  const raw = String(authHeader);
  if (raw.length <= 20) {
    return '***';
  }

  return `${raw.slice(0, 12)}***${raw.slice(-6)}`;
}

function buildFailureReason(details = {}) {
  const stage = details.stage || 'unknown';
  const endpoint = details.endpoint || '-';
  const http = details.httpStatus !== undefined && details.httpStatus !== null ? details.httpStatus : '-';
  const code = details.code || '-';
  const msg = previewText(details.message || '-', 120).replace(/\|/g, '/');
  const raw = previewText(details.raw || '-', 160).replace(/\|/g, '/');

  return `DANA_FAIL|stage=${stage}|endpoint=${endpoint}|http=${http}|code=${code}|msg=${msg}|raw=${raw}`;
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
  console.log('  Timestamp length:', timestamp.length);
  console.log('  Timestamp format valid:', timestamp.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/) ? '✅' : '❌');
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

  // Optional SNAP headers (set via env when required by DANA environment)
  if (process.env.DANA_ORIGIN) {
    headers['ORIGIN'] = process.env.DANA_ORIGIN;
  }
  if (process.env.DANA_IP_ADDRESS) {
    headers['X-IP-ADDRESS'] = process.env.DANA_IP_ADDRESS;
  }
  if (process.env.DANA_DEVICE_ID) {
    headers['X-DEVICE-ID'] = process.env.DANA_DEVICE_ID;
  }

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
    
    const beneficiaryAccountNumber = (
      process.env.DANA_BENEFICIARY_ACCOUNT_NUMBER ||
      withdrawalData.bank_account_number ||
      ''
    ).toString().replace(/\s+/g, '');

    if (!beneficiaryAccountNumber) {
      throw new Error('Missing beneficiary account number for DANA transfer');
    }

    const beneficiaryAccountName = (withdrawalData.bank_account_holder || '').toString().trim();

    // Build additionalInfo - only include fields that are configured
    const additionalInfo = {
      fundType: 'MERCHANT_WITHDRAW_FOR_CORPORATE',
      needNotify: (process.env.DANA_NEED_NOTIFY || 'true').toString(),
      beneficiaryAccountName: beneficiaryAccountName || undefined
    };
    
    // Only add chargeTarget and externalDivisionId if explicitly configured
    // By default, chargeTarget: MERCHANT (does NOT require externalDivisionId)
    const chargeTarget = process.env.DANA_CHARGE_TARGET || 'MERCHANT';
    if (chargeTarget) {
      additionalInfo.chargeTarget = chargeTarget;
    }
    
    // Only add externalDivisionId if configured AND chargeTarget is DIVISION
    if (process.env.DANA_EXTERNAL_DIVISION_ID && chargeTarget === 'DIVISION') {
      additionalInfo.externalDivisionId = process.env.DANA_EXTERNAL_DIVISION_ID;
    }

    // Prepare disbursement payload aligned with DANA transfer-to-bank guide
    const payload = {
      partnerReferenceNo: partnerReferenceNo,
      customerNumber: customerNumber,  // ✅ Phone format 628xxxx
      accountType: process.env.DANA_ACCOUNT_TYPE || 'SETTLEMENT_ACCOUNT',
      beneficiaryAccountNumber: beneficiaryAccountNumber,
      beneficiaryBankCode: beneficiaryBankCode,
      amount: {
        value: amountValue,  // ✅ With .00 format
        currency: 'IDR'
      },
      additionalInfo: additionalInfo
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
    console.log(`� Timestamp Details:`, {
      full: headers['X-TIMESTAMP'],
      length: headers['X-TIMESTAMP']?.length,
      format: 'YYYY-MM-DDTHH:mm:ss+07:00'
    });
    console.log(`�📋 Request Headers:`, {
      ...headers,
      'X-SIGNATURE': headers['X-SIGNATURE'] ? headers['X-SIGNATURE'].substring(0, 30) + '...' : 'missing',
      'Authorization': maskAuthHeader(headers['Authorization'])
    });

    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log(`🔄 Trying endpoint: ${endpoint.url}`);
        console.log(`⏱️  Using timeout: 30000ms (30 seconds)`);
        
        response = await axios.post(
          endpoint.url,
          payload,
          {
            headers: {
              ...headers
            },
            timeout: 30000
          }
        );

        console.log(`✅ Success with endpoint: ${endpoint.url}`);
        console.log(`📝 DANA Response Status: ${response.status}`);
        console.log(`📝 DANA Response Headers:`, {
          'content-type': response.headers['content-type'],
          'x-dana-signature': response.headers['x-dana-signature'] ? '***' : 'none'
        });
        
        // Enhanced response diagnostics
        console.log(`🔍 Response Type Analysis:`);
        console.log(`  - Type: ${typeof response.data}`);
        console.log(`  - Is null: ${response.data === null}`);
        console.log(`  - Is undefined: ${response.data === undefined}`);
        console.log(`  - Is Array: ${Array.isArray(response.data)}`);
        
        if (typeof response.data === 'string') {
          console.log(`  - String length: ${response.data.length}`);
          console.log(`  - First 500 chars: ${response.data.substring(0, 500)}`);
        } else if (typeof response.data === 'object' && response.data !== null) {
          const dataStr = JSON.stringify(response.data);
          console.log(`  - JSON string length: ${dataStr.length}`);
          console.log(`  - Object keys: ${Object.keys(response.data).join(', ') || '(no keys)'}`);
          console.log(`  - Object entries count: ${Object.keys(response.data).length}`);
        }
        
        console.log(`📝 DANA Response Data:`, JSON.stringify(response.data, null, 2));
        console.log(`📝 Response Keys:`, Object.keys(response.data || {}));
        
        // Validate response is not empty
        if (typeof response.data === 'string' && response.data.length === 0) {
          console.warn(`⚠️  Endpoint returned empty string, trying next endpoint...`);
          const emptyError = new Error('Empty response from DANA endpoint');
          emptyError.danaMeta = {
            stage: 'response_validation',
            endpoint: endpoint.path,
            httpStatus: response.status,
            code: 'EMPTY_RESPONSE',
            message: 'DANA returned empty string',
            raw: '(empty string)'
          };
          throw emptyError;
        }
        
        // Validate response has expected structure
        if (typeof response.data === 'object' && response.data !== null && 
            !response.data.responseCode && !response.data.resultInfo?.resultCode) {
          console.warn(`⚠️  Response missing responseCode, structure might be invalid`);
        }
        
        break; // Success! Stop trying other endpoints
        
      } catch (err) {
        const endpointCode = err.response?.data?.responseCode ||
                            err.response?.data?.resultInfo?.resultCode ||
                            err.response?.data?.errorCode;
        const endpointMessage = err.response?.data?.responseMessage ||
                               err.response?.data?.resultInfo?.resultMsg ||
                               err.response?.data?.errorMessage ||
                               err.response?.data?.message ||
                               err.message;
        const endpointRaw = err.response?.data || err.message;

        err.danaMeta = {
          stage: 'request_send',
          endpoint: endpoint.path,
          httpStatus: err.response?.status,
          code: endpointCode,
          message: endpointMessage,
          raw: endpointRaw,
          errorType: err.code || err.name
        };

        lastError = err;
        console.error(`❌ Endpoint ${endpoint.url} failed: HTTP ${err.response?.status || 'NO_RESPONSE'}`);
        console.error(`❌ Error Type: ${err.code || err.name}`);
        console.error(`❌ Error Message: ${err.message}`);
        
        if (err.response) {
          console.error(`❌ Response Status: ${err.response.status} ${err.response.statusText}`);
          console.error(`❌ Response Headers:`, JSON.stringify(err.response.headers, null, 2));
          console.error(`❌ Response Data:`, JSON.stringify(err.response.data, null, 2));
        } else if (err.request) {
          console.error(`❌ No response received. Request was made but no response.`);
          console.error(`❌ Request details:`, {
            method: err.config?.method,
            url: err.config?.url,
            timeout: err.config?.timeout
          });
        } else {
          console.error(`❌ Error setting up request:`, err.message);
        }
        
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
    const responseCode = response.data?.responseCode ||
              response.data?.resultInfo?.resultCode ||
              response.data?.resultCode ||
              response.data?.code;
    const responseMessage = response.data?.responseMessage ||
                 response.data?.resultInfo?.resultMsg ||
                 response.data?.resultMsg ||
                 response.data?.message;
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

    const isSuccess = responseCode === '2004300' || responseCode === '2024300';
    const rawResponsePreview = typeof response.data === 'string'
      ? response.data.slice(0, 240)
      : JSON.stringify(response.data || {}).slice(0, 240);

    const failureMessage = responseMessage ||
                          danaData?.errorMessage ||
                          danaData?.message ||
                          (responseCode ? `DANA request failed with responseCode ${responseCode}` : `DANA request failed - unexpected response: ${rawResponsePreview}`);

    const failureReason = buildFailureReason({
      stage: 'response_parse',
      endpoint: relativePath,
      httpStatus: response.status,
      code: responseCode,
      message: failureMessage,
      raw: rawResponsePreview
    });

    return {
      success: isSuccess,
      disbursementId: disbursementId,  // ✅ Can be null - callback will update it
      partnerReferenceNo: partnerReferenceNo,
      status: status,
      responseCode: responseCode,
      response: response.data,
      error: isSuccess ? null : failureMessage,
      errorCode: isSuccess ? null : responseCode,
      failureReason: isSuccess ? null : failureReason
    };

  } catch (error) {
    // Extract DANA error message from response
    const danaErrorCode = error.danaMeta?.code ||
                         error.response?.data?.errorCode ||
                         error.response?.data?.responseCode;
    const danaErrorMsg = error.response?.data?.errorMessage || 
                        error.response?.data?.responseMessage || 
                        error.response?.data?.message || 
                        error.danaMeta?.message ||
                        error.message;
    const statusCode = error.danaMeta?.httpStatus || error.response?.status;
    const endpointPath = error.danaMeta?.endpoint || relativePath;
    const rawFailureData = error.danaMeta?.raw || error.response?.data || error.message;
    const failureReason = buildFailureReason({
      stage: error.danaMeta?.stage || 'request_send',
      endpoint: endpointPath,
      httpStatus: statusCode,
      code: danaErrorCode,
      message: danaErrorMsg,
      raw: rawFailureData
    });
    
    // Special handling for gateway errors (DANA sandbox down)
    if (statusCode === 502 || statusCode === 504) {
      console.error(`🔴 DANA Sandbox appears to be down or under maintenance`);
      console.error(`   Status: ${statusCode} ${statusCode === 502 ? 'Bad Gateway' : 'Gateway Timeout'}`);
      console.error(`   This is a DANA server issue, not a request issue.`);
      console.error(`   ⏰ Retry later or contact DANA IT support.`);
      
      return {
        success: false,
        error: 'DANA_SANDBOX_UNAVAILABLE',
        errorMessage: `DANA sandbox is currently unavailable (${statusCode}). Please try again later.`,
        errorCode: 'SERVICE_UNAVAILABLE',
        statusCode: statusCode,
        retryable: true,
        failureReason: failureReason
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
      statusCode: statusCode,
      retryable: false,
      failureReason: failureReason
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
