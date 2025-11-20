#!/bin/bash

# Script untuk menjalankan migration ke Railway database
# 
# Cara penggunaan:
# 1. Dapatkan Railway database credentials dari Railway dashboard
# 2. Set environment variables di terminal atau edit file ini
# 3. Jalankan: bash run_railway_migration.sh

echo "🚀 Running migration to Railway database..."
echo ""

# Cek apakah environment variables sudah di-set
if [ -z "$MYSQLHOST" ]; then
    echo "❌ Error: MYSQLHOST environment variable tidak di-set!"
    echo ""
    echo "Cara set environment variables:"
    echo "  export MYSQLHOST='your-host.railway.app'"
    echo "  export MYSQLUSER='root'"
    echo "  export MYSQLPASSWORD='your-password'"
    echo "  export MYSQLDATABASE='railway'"
    echo "  export MYSQLPORT='3306'"
    echo ""
    echo "Atau edit script ini dan uncomment baris di bawah:"
    echo ""
    echo "# export MYSQLHOST='your-host.railway.app'"
    echo "# export MYSQLUSER='root'"
    echo "# export MYSQLPASSWORD='your-password'"
    echo "# export MYSQLDATABASE='railway'"
    echo "# export MYSQLPORT='3306'"
    exit 1
fi

echo "📡 Connecting to: $MYSQLHOST"
echo "📊 Database: $MYSQLDATABASE"
echo ""

# Jalankan migration
node migrations/run_pickup_dropoff_migration.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
else
    echo ""
    echo "❌ Migration failed!"
    exit 1
fi
