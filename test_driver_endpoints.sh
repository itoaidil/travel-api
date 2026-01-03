#!/bin/bash

# Test Driver API Endpoints
# Run this after deploying to Railway

BASE_URL="https://travel-api-production-23ae.up.railway.app"
DRIVER_ID=12  # Change to actual driver ID from database

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        🧪 TESTING DRIVER API ENDPOINTS                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Test 1: Register FCM Token
echo "1️⃣  Testing: POST /api/driver/register-fcm"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X POST "$BASE_URL/api/driver/register-fcm" \
  -H "Content-Type: application/json" \
  -d '{
    "driver_id": '$DRIVER_ID',
    "fcm_token": "test_token_abc123",
    "device_type": "android"
  }'
echo -e "\n"

# Test 2: Update Online Status (Online)
echo "2️⃣  Testing: POST /api/driver/online-status (ONLINE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X POST "$BASE_URL/api/driver/online-status" \
  -H "Content-Type: application/json" \
  -d '{
    "driver_id": '$DRIVER_ID',
    "is_online": true
  }'
echo -e "\n"

# Test 3: Send GPS Heartbeat
echo "3️⃣  Testing: POST /api/driver-location/heartbeat"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X POST "$BASE_URL/api/driver-location/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{
    "driver_id": '$DRIVER_ID',
    "latitude": -6.9175,
    "longitude": 107.6191,
    "accuracy": 15.5,
    "speed": 30.5,
    "heading": 180
  }'
echo -e "\n"

# Test 4: Get Driver Profile
echo "4️⃣  Testing: GET /api/driver/profile"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X GET "$BASE_URL/api/driver/profile?driver_id=$DRIVER_ID"
echo -e "\n"

# Test 5: Accept Booking (need actual offer_id from database)
echo "5️⃣  Testing: POST /api/broadcast/respond (ACCEPT)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Skipped: Need actual offer_id from database"
echo "Example:"
echo 'curl -X POST "'$BASE_URL'/api/broadcast/respond" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{'
echo '    "offer_id": "offer_wave1_1",'
echo '    "driver_id": '$DRIVER_ID','
echo '    "response": "accepted"'
echo '  }'"'"
echo ""

# Test 6: Reject Booking
echo "6️⃣  Testing: POST /api/broadcast/respond (REJECT)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Skipped: Need actual offer_id from database"
echo "Example:"
echo 'curl -X POST "'$BASE_URL'/api/broadcast/respond" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{'
echo '    "offer_id": "offer_wave1_1",'
echo '    "driver_id": '$DRIVER_ID','
echo '    "response": "rejected",'
echo '    "reason": "Terlalu jauh dari lokasi saya"'
echo '  }'"'"
echo ""

# Test 7: Update Online Status (Offline)
echo "7️⃣  Testing: POST /api/driver/online-status (OFFLINE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X POST "$BASE_URL/api/driver/online-status" \
  -H "Content-Type: application/json" \
  -d '{
    "driver_id": '$DRIVER_ID',
    "is_online": false
  }'
echo -e "\n"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Test selesai! Check responses di atas.                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
