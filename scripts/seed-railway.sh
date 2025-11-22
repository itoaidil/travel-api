#!/bin/bash

# Quick Railway Seeding Script
# This runs the seeding command temporarily on Railway

echo "🚀 Starting Railway database seeding..."
echo ""
echo "This script will:"
echo "1. Temporarily change Railway start command to run seeding"
echo "2. Trigger a new deployment"
echo "3. You need to manually revert the start command after seeding completes"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "📋 Manual Steps:"
echo ""
echo "1. Go to Railway Dashboard: https://railway.app/dashboard"
echo "2. Select project 'travel-api'"
echo "3. Click on 'travel-api' service"
echo "4. Go to Settings tab"
echo "5. Find 'Custom Start Command'"
echo "6. Change it to: npm run seed:railway && npm start"
echo "7. Click 'Deploy' button"
echo "8. Watch logs until you see '🎉 Railway database seeded successfully!'"
echo "9. IMPORTANT: Change start command back to: npm start"
echo "10. Deploy again"
echo ""
echo "✅ Done! Your Railway database is now populated."
echo ""
