-- Add pickup and dropoff coordinates and addresses to bookings table
ALTER TABLE bookings 
ADD COLUMN pickup_lat DECIMAL(10, 8) NULL,
ADD COLUMN pickup_lng DECIMAL(11, 8) NULL,
ADD COLUMN pickup_address TEXT NULL,
ADD COLUMN dropoff_lat DECIMAL(10, 8) NULL,
ADD COLUMN dropoff_lng DECIMAL(11, 8) NULL,
ADD COLUMN dropoff_address TEXT NULL;

-- Add indexes for better query performance
CREATE INDEX idx_bookings_pickup ON bookings(pickup_lat, pickup_lng);
CREATE INDEX idx_bookings_dropoff ON bookings(dropoff_lat, dropoff_lng);
