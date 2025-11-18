-- Add pickup_location and dropoff_location columns to bookings table

ALTER TABLE bookings 
ADD COLUMN pickup_location VARCHAR(255) NOT NULL DEFAULT '' AFTER num_passengers,
ADD COLUMN dropoff_location VARCHAR(255) NOT NULL DEFAULT '' AFTER pickup_location;

-- Update existing records with default values if any
UPDATE bookings 
SET pickup_location = COALESCE(pickup_location, ''),
    dropoff_location = COALESCE(dropoff_location, '')
WHERE pickup_location IS NULL OR dropoff_location IS NULL;
