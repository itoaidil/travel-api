#!/bin/bash

# Quick Test Script for OTP System
# Usage: ./test_otp_api.sh

BASE_URL="https://travel-api-production-23ae.up.railway.app"
# For local testing, uncomment the line below:
# BASE_URL="http://localhost:3000"

echo ""
echo "🧪 OTP System API Testing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Base URL: $BASE_URL"
echo ""

# Generate random email for testing
TIMESTAMP=$(date +%s)
TEST_EMAIL="test${TIMESTAMP}@example.com"
TEST_PHONE="08${TIMESTAMP:5:10}"
TEST_OTP=""

echo "📧 Test Email: $TEST_EMAIL"
echo "📱 Test Phone: $TEST_PHONE"
echo ""

# Test 1: Register Customer
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Register Customer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "POST $BASE_URL/api/auth/register"
echo ""

REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test User ${TIMESTAMP}\",
    \"phone\": \"$TEST_PHONE\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"password123\"
  }")

echo "$REGISTER_RESPONSE" | jq '.'

# Check if registration was successful
if echo "$REGISTER_RESPONSE" | grep -q "customerId"; then
    echo ""
    echo "✅ Registration successful!"
    CUSTOMER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.customerId')
    echo "Customer ID: $CUSTOMER_ID"
    echo ""
    echo "⚠️  Check Railway logs for OTP code:"
    echo "   railway logs --tail 50"
    echo ""
    echo "Look for: '📧 ========== EMAIL OTP (TESTING MODE) =========='"
    echo ""
else
    echo ""
    echo "❌ Registration failed!"
    exit 1
fi

# Prompt for OTP
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Verify OTP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Enter OTP code from Railway logs: " TEST_OTP

if [ -z "$TEST_OTP" ]; then
    echo "❌ No OTP entered. Skipping verification test."
    exit 0
fi

echo ""
echo "POST $BASE_URL/api/auth/verify-otp"
echo ""

VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"otpCode\": \"$TEST_OTP\"
  }")

echo "$VERIFY_RESPONSE" | jq '.'

# Check if verification was successful
if echo "$VERIFY_RESPONSE" | grep -q "token"; then
    echo ""
    echo "✅ OTP verification successful!"
    TOKEN=$(echo "$VERIFY_RESPONSE" | jq -r '.token')
    echo "JWT Token: ${TOKEN:0:50}..."
    echo ""
    echo "🎉 Customer account is now active!"
else
    echo ""
    echo "❌ OTP verification failed!"
    echo ""
    echo "Common reasons:"
    echo "  - Wrong OTP code"
    echo "  - OTP expired (>5 minutes)"
    echo "  - Too many attempts (>3)"
    echo ""
    echo "Try Test 3 to resend OTP..."
fi

# Test 3: Resend OTP (optional)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Resend OTP (optional)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Do you want to test OTP resend? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "POST $BASE_URL/api/auth/resend-otp"
    echo ""
    
    RESEND_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/resend-otp" \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"$TEST_EMAIL\"
      }")
    
    echo "$RESEND_RESPONSE" | jq '.'
    
    if echo "$RESEND_RESPONSE" | grep -q "Kode OTP baru"; then
        echo ""
        echo "✅ OTP resend successful!"
        echo ""
        echo "Check Railway logs for new OTP code"
    else
        echo ""
        echo "❌ OTP resend failed!"
        echo ""
        echo "Possible reasons:"
        echo "  - Rate limit (must wait 60 seconds)"
        echo "  - Daily limit reached (max 5 per day)"
        echo "  - Email already verified"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Testing complete!"
echo ""
echo "📊 Database Check (optional):"
echo "   mysql> SELECT * FROM otp_verifications WHERE email = '$TEST_EMAIL';"
echo "   mysql> SELECT * FROM customers WHERE email = '$TEST_EMAIL';"
echo ""
echo "📖 Full Documentation: OTP_SYSTEM_DOCUMENTATION.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
