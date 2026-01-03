#!/bin/bash
# Run migration on Railway database
# Make sure you have Railway CLI installed: npm install -g @railway/cli

echo "🚂 Running database migration on Railway..."
echo "============================================="

# Get database credentials from Railway
RAILWAY_DB_URL=$(railway variables get DATABASE_URL 2>/dev/null || echo "")

if [ -z "$RAILWAY_DB_URL" ]; then
  echo "❌ Error: Cannot get DATABASE_URL from Railway"
  echo "Please run: railway login"
  echo "Then run this script again"
  exit 1
fi

# Extract connection info from DATABASE_URL
# Format: mysql://username:password@host:port/database
DB_USER=$(echo $RAILWAY_DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $RAILWAY_DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $RAILWAY_DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $RAILWAY_DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $RAILWAY_DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "📊 Database: $DB_NAME"
echo "🌍 Host: $DB_HOST:$DB_PORT"
echo ""

# Run migration SQL file
echo "Running migration: add_driver_location_tracking.sql"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < add_driver_location_tracking.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration completed successfully!"
  echo ""
  echo "Verifying drivers table..."
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
    SELECT 
      id, name, vehicle_type, 
      current_lat, current_lng, 
      status, is_available,
      last_location_update
    FROM drivers 
    WHERE status = 'online' 
    LIMIT 5;
  "
else
  echo "❌ Migration failed!"
  exit 1
fi
