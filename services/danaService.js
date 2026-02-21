/**
 * DANA Disbursement Service
 * Handles communication with DANA API for bank transfers using official dana-node library
 */

const DanaClient = require('dana-node');

// Initialize DANA client with credentials from environment
let danaClient = null;

function initializeDanaClient() {
  if (danaClient) {
    return danaClient;
  }

  try {
    // Format private key with proper PEM markers if not already formatted
    let privateKey = process.env.DANA_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (privateKey && !privateKey.includes('BEGIN PRIVATE KEY')) {
      privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
    }

    // Initialize DANA client
    danaClient = new DanaClient({
      env: process.env.DANA_ENV || process.env.ENV || 'sandbox',
      clientId: process.env.DANA_CLIENT_ID || process.env.X_PARTNER_ID,
      clientSecret: process.env.DANA_CLIENT_SECRET,
      merchantId: process.env.DANA_MERCHANT_ID,
      privateKey: privateKey,
      publicKey: process.env.DANA_PUBLIC_KEY
    });

    console.log('✅ DANA client initialized successfully');
    return danaClient;
  } catch (error) {
    console.error('❌ Failed to initialize DANA client:', error.message);
    throw error;
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
 * Create disbursement to bank account via DANA using official library
 * @param {Object} withdrawalData - Withdrawal information
 * @returns {Promise<Object>} DANA disbursement response
 */
async function createDisbursement(withdrawalData) {
  try {
    console.log('🚀 Creating DANA disbursement for withdrawal:', withdrawalData.id);

    // Initialize DANA client
    const client = initializeDanaClient();

    // Generate unique reference number
    const partnerReferenceNo = `WD-${withdrawalData.id}-${Date.now()}`;
    
    // Prepare disbursement request
    const disbursementRequest = {
      partnerReferenceNo: partnerReferenceNo,
      amount: {
        value: withdrawalData.amount.toString(),
        currency: 'IDR'
      },
      beneficiaryAccountNo: withdrawalData.bank_account_number,
      beneficiaryAccountName: withdrawalData.bank_account_holder,
      beneficiaryBankCode: getBankCode(withdrawalData.bank_name),
      description: `Withdrawal untuk Driver ${withdrawalData.driver_id}`,
      additionalInfo: {
        withdrawalId: withdrawalData.id.toString(),
        driverId: withdrawalData.driver_id.toString()
      }
    };

    console.log('💸 Sending disbursement request to DANA...');

    // Call DANA disbursement API using the official library
    const response = await client.disbursement.create(disbursementRequest);

    console.log('✅ DANA disbursement created:', response);

    return {
      success: true,
      disbursementId: response.disbursementId || response.referenceNo || response.partnerReferenceNo,
      partnerReferenceNo: partnerReferenceNo,
      status: response.status || response.disbursementStatus || 'PROCESSING',
      response: response
    };

  } catch (error) {
    console.error('❌ DANA disbursement failed:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.responseMessage || error.message,
      errorCode: error.response?.data?.responseCode || error.code || 'UNKNOWN_ERROR'
    };
  }
}

/**
 * Check disbursement status from DANA using official library
 * @param {string} partnerReferenceNo - Partner reference number
 * @returns {Promise<Object>} Disbursement status
 */
async function checkDisbursementStatus(partnerReferenceNo) {
  try {
    console.log('🔍 Checking DANA disbursement status:', partnerReferenceNo);

    // Initialize DANA client
    const client = initializeDanaClient();

    // Query disbursement status
    const response = await client.disbursement.getStatus(partnerReferenceNo);

    console.log('✅ DANA status retrieved:', response);

    return {
      success: true,
      status: response.disbursementStatus || response.status,
      data: response
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
