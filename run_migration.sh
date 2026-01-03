#!/bin/bash
# Run this migration to add seats columns to travels table

echo "Running migration: add_seats_to_travels.sql"

# You can run this in Railway using MySQL client or in your local MySQL
# Replace connection details as needed

mysql -h <your-railway-mysql-host> \
      -P <port> \
      -u <user> \
      -p<password> \
      <database> < migrations/add_seats_to_travels.sql

echo "Migration completed!"
