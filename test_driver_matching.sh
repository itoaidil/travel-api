#!/bin/bash
# Quick test script for driver matching API

echo "🔍 Testing Driver Matching API"
echo "================================"

BASE_URL="https://travel-api-production-23ae.up.railway.app/api"

echo ""
echo "Test 1: Search motorcycle drivers near Monas"
echo "----------------------------------------------"
curl -s "${BASE_URL}/drivers/nearby?lat=-6.1751&lng=106.8270&vehicle_type=motorcycle&radius=10&limit=5" | jq '.'

echo ""
echo ""
echo "Test 2: Search bike drivers near Kemang"
echo "----------------------------------------------"
curl -s "${BASE_URL}/drivers/nearby?lat=-6.2655&lng=106.8167&vehicle_type=bike&radius=10&limit=5" | jq '.'

echo ""
echo ""
echo "Test 3: Missing vehicle_type (should return error)"
echo "----------------------------------------------"
curl -s "${BASE_URL}/drivers/nearby?lat=-6.1751&lng=106.8270&radius=10" | jq '.'

echo ""
echo "✅ Tests completed!"
