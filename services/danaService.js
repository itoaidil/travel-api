/**
 * DANA Disbursement Service
 * Handles communication with DANA API for bank transfers using official dana-node library
 */

const { Dana } = require('dana-node');

// Initialize DANA client
let danaClient = null;
let disbursementApi = null;

/**
 * Initialize DANA client with credentials from environment variables
 */
function initializeDanaClient() {
  if (danaClient) {
    return danaClient;
  }

  try {
    console.log('🔐 Initializing DANA client...');
    
    // Validate required environment variables
    const requiredVars = ['DANA_CLIENT_ID', 'DANA_PRIVATE_KEY', 'DANA_CLIENT_SECRET'];
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        throw new Error(`${varName} not configured in environment variables`);
      }
    }

    danaClient = new Dana({
      partnerId: process.env.DANA_CLIENT_ID,           // Client ID from DANA dashboard
      privateKey: process.env.DANA_PRIVATE_KEY,        // Private key for signing
      origin: process.env.DANA_ORIGIN || 'travel-api', // Application origin
      env: process.env.DANA_ENV || 'sandbox',          // sandbox or production
      clientSecret: process.env.DANA_CLIENT_SECRET     // Client secret
    });

    disbursementApi = danaClient.disbursementApi;
    
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
    'BRI': 'BRI',
    'Bank BRI': 'BRI',
    'Bank Rakyat Indonesia': 'BRI',
    'Mandiri': 'MANDIRI',
    'Bank Mandiri': 'MANDIRI',
    'BNI': 'BNI',
    'Bank BNI': 'BNI',
    'Bank Negara Indonesia': 'BNI',
    'BCA': 'BCA',
    'Bank BCA': 'BCA',
    'Bank Central Asia': 'BCA',
    'CIMB': 'CIMB_NIAGA',
    'CIMB Niaga': 'CIMB_NIAGA',
    'Bank CIMB': 'CIMB_NIAGA',
    'BTPN': 'BTPN',
    'Bank BTPN': 'BTPN',
    'BSI': 'BSI',
    'Bank Syariah Indonesia': 'BSI',
    'BankSyariah': 'BSI'
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
  return 'BCA';
}

/**
 * Create disbursement to bank account via DANA
 * @param {Object} withdrawalData - Withdrawal information
 * @returns {Promise<Object>} DANA disbursement response
 */
async function createDisbursement(withdrawalData) {
  try {
    console.log('🚀 Creating DANA disbursement for withdrawal:', withdrawalData.id);

    // Initialize DANA client
    initializeDanaClient();
    
    if (!disbursementApi) {
      throw new Error('DANA disbursementApi not initialized');
    }

    // Prepare disbursement request
    const partnerReferenceNo = `WD-${withdrawalData.id}-${Date.now()}`;
    
    const request = {
      partnerReferenceNo: partnerReferenceNo,
      amount: {
        value: withdrawalData.amount.toString(),
        currency: 'IDR'
      },
      beneficiaryAccountNumber: withdrawalData.bank_account_number,
      beneficiaryAccountName: withdrawalData.bank_account_holder,
      additionalInfo: {
        fundType: 'CASH',
        beneficiaryBankCode: getBankCode(withdrawalData.bank_name),
        remarks: `Withdrawal untuk Driver ${withdrawalData.driver_id}`,
        withdrawalId: withdrawalData.id.toString(),
        driverId: withdrawalData.driver_id.toString()
      }
    };

    console.log(`💸 Calling DANA disbursementApi.executeTransferToBank...`);
    console.log('   Request:', JSON.stringify(request, null, 2));

    // Execute transfer using DANA official library
    const response = await disbursementApi.executeTransferToBank(request);

    console.log('✅ DANA disbursement created:', JSON.stringify(response, null, 2));

    return {
      success: true,
      disbursementId: response.disbursementId || response.referenceNo,
      partnerReferenceNo: partnerReferenceNo,
      status: response.status || 'PROCESSING',
      response: response
    };

  } catch (error) {
    console.error('❌ DANA disbursement failed:', error.message);
    console.error('   Error details:', error.response?.data || error);
    
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
    console.log('🔍 Checking DANA disbursement status for:', partnerReferenceNo);
    
    // Initialize DANA client
    initializeDanaClient();
    
    if (!disbursementApi) {
      throw new Error('DANA disbursementApi not initialized');
    }

    const request = {
      partnerReferenceNo: partnerReferenceNo
    };

    // Query disbursement status using DANA official library
    const response = await disbursementApi.queryTransferToBank(request);

    console.log('✅ DANA status retrieved:', JSON.stringify(response, null, 2));

    return {
      success: true,
      status: response.disbursementStatus || response.status,
      data: response
    };

  } catch (error) {
    console.error('❌ Failed to check DANA status:', error.message);
    console.error('   Error details:', error.response?.data || error);
    
    return {
      success: false,
      error: error.response?.data?.responseMessage || error.message
    };
  }
}

/**
 * Validate bank account before disbursement
 * @param {Object} accountInfo - Bank account information
 * @returns {Promise<Object>} Validation result
 */
async function validateBankAccount(accountInfo) {
  try {
    console.log('✅ Validating bank account:', accountInfo.accountNumber);
    
    // Initialize DANA client
    initializeDanaClient();
    
    if (!disbursementApi) {
      throw new Error('DANA disbursementApi not initialized');
    }

    const request = {
      beneficiaryAccountNumber: accountInfo.accountNumber,
      amount: {
        value: accountInfo.amount || '10000', // Minimum amount for inquiry
        currency: 'IDR'
      },
      additionalInfo: {
        fundType: 'CASH',
        beneficiaryBankCode: getBankCode(accountInfo.bankName)
      }
    };

    // Validate using bank account inquiry API
    const response = await disbursementApi.bankAccountInquiry(request);

    console.log('✅ Bank account validated:', JSON.stringify(response, null, 2));

    return {
      success: true,
      accountName: response.beneficiaryAccountName,
      accountNumber: response.beneficiaryAccountNumber,
      data: response
    };

  } catch (error) {
    console.error('❌ Bank account validation failed:', error.message);
    console.error('   Error details:', error.response?.data || error);
    
    return {
      success: false,
      error: error.response?.data?.responseMessage || error.message,
      errorCode: error.response?.data?.responseCode || 'VALIDATION_FAILED'
    };
  }
}

module.exports = {
  initializeDanaClient,
  createDisbursement,
  checkDisbursementStatus,
  validateBankAccount,
  getBankCode
};
