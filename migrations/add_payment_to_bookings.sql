-- Add payment_method and customer_id columns to bookings table

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cod',
ADD COLUMN IF NOT EXISTS customer_id INT,
ADD INDEX (customer_id);

-- Update existing bookings to have default customer_id if needed
-- (optional, depends on your existing data)
