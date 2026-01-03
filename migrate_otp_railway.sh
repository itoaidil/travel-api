#!/bin/bash

# Railway Database Migration Script for OTP System
# This script connects to Railway MySQL and runs the migration

echo ""
echo "🗄️  Railway MySQL Migration - OTP System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Railway MySQL Connection Details
# Get these from: Railway Dashboard → MySQL → Connect
echo "📋 Enter Railway MySQL credentials:"
echo ""
read -p "Host (e.g., monorail.proxy.rlwy.net): " DB_HOST
read -p "Port (default 3306): " DB_PORT
DB_PORT=${DB_PORT:-3306}
read -p "User (usually 'root'): " DB_USER
read -sp "Password: " DB_PASSWORD
echo ""
read -p "Database name (usually 'railway'): " DB_NAME

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test connection first
echo "🔌 Testing database connection..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT 1;" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Connection successful!"
else
    echo "❌ Connection failed! Please check your credentials."
    exit 1
fi

# Run migration
echo ""
echo "📦 Running OTP migration..."
echo ""

mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < migrations/create_otp_table.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
else
    echo ""
    echo "❌ Migration failed!"
    exit 1
fi

# Verify migration
echo ""
echo "🔍 Verifying migration..."
echo ""

# Check otp_verifications table
echo "Checking otp_verifications table..."
TABLE_EXISTS=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES LIKE 'otp_verifications';" -s -N)

if [ -n "$TABLE_EXISTS" ]; then
    echo "✅ otp_verifications table created"
    
    # Show table structure
    echo ""
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "DESCRIBE otp_verifications;"
else
    echo "❌ otp_verifications table not found"
    exit 1
fi

# Check customers table columns
echo ""
echo "Checking customers table updates..."
EMAIL_VERIFIED=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW COLUMNS FROM customers LIKE 'email_verified';" -s -N)
IS_ACTIVE=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW COLUMNS FROM customers LIKE 'is_active';" -s -N)

if [ -n "$EMAIL_VERIFIED" ]; then
    echo "✅ email_verified column added to customers"
else
    echo "⚠️  email_verified column not found in customers"
fi

if [ -n "$IS_ACTIVE" ]; then
    echo "✅ is_active column added to customers"
else
    echo "⚠️  is_active column not found in customers"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ OTP System Migration Complete!"
echo ""
echo "📝 Next Steps:"
echo "   1. Set EMAIL_MODE=testing in Railway Dashboard"
echo "   2. Deploy code: ./deploy_otp_system.sh"
echo "   3. Test endpoints: ./test_otp_api.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
