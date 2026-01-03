#!/bin/bash

echo "🚀 Deploying Migration to Railway..."
echo ""

# Push migration script to Railway
echo "📤 Pushing code to Railway..."
railway up

echo ""
echo "⏳ Waiting for deployment..."
sleep 5

echo ""
echo "🔄 Running migration script on Railway..."
railway run node scripts/seed_locations.js

echo ""
echo "✅ Migration completed!"
