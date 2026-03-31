-- 025_create_service_tiers_and_pooling.sql
-- Service tier config + bareng/pooling config and operational tables

CREATE TABLE IF NOT EXISTS service_tiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  label VARCHAR(60) NOT NULL,
  description VARCHAR(255) NULL,
  multiplier DECIMAL(6,4) NOT NULL DEFAULT 1.0000,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_service_tiers_active (is_active),
  INDEX idx_service_tiers_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO service_tiers (code, label, description, multiplier, sort_order, is_active)
VALUES
  ('ngebut', 'Ngebut', 'Driver khusus, lebih cepat sampai', 1.4000, 1, 1),
  ('normal', 'Normal', 'Pengiriman standar', 1.0000, 2, 1),
  ('bareng', 'Bareng', 'Hemat biaya, waktu tunggu sedikit lebih lama', 0.8000, 3, 1)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  multiplier = VALUES(multiplier),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS app_config (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` VARCHAR(500) NOT NULL,
  description VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_config (`key`, `value`, description)
VALUES
  ('bareng_fallback_mode', 'keep_bareng_price', 'keep_bareng_price | upgrade_to_normal_price'),
  ('bareng_wait_timeout_minutes', '5', 'Waktu tunggu pairing bareng sebelum fallback'),
  ('bareng_max_pool_size', '2', 'Maksimal order dalam 1 group bareng'),
  ('bareng_max_detour_km', '2', 'Batas tambahan jarak untuk pair bareng')
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;

ALTER TABLE independent_bookings
  ADD COLUMN IF NOT EXISTS service_tier VARCHAR(30) NULL DEFAULT 'normal' AFTER booking_type,
  ADD COLUMN IF NOT EXISTS tier_multiplier DECIMAL(6,4) NULL DEFAULT 1.0000 AFTER service_tier,
  ADD COLUMN IF NOT EXISTS normal_fare_before_tier INT NULL AFTER total_fare,
  ADD COLUMN IF NOT EXISTS final_fare_after_tier INT NULL AFTER normal_fare_before_tier,
  ADD COLUMN IF NOT EXISTS pricing_meta_json JSON NULL AFTER final_fare_after_tier,
  ADD COLUMN IF NOT EXISTS pooling_group_id BIGINT NULL AFTER pricing_meta_json;

CREATE TABLE IF NOT EXISTS pooling_groups (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NULL,
  status ENUM('open','matched','in_progress','completed','cancelled') NOT NULL DEFAULT 'open',
  max_slots INT NOT NULL DEFAULT 2,
  current_slots INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pooling_groups_status (status),
  INDEX idx_pooling_groups_driver (driver_id),
  CONSTRAINT fk_pooling_groups_driver
    FOREIGN KEY (driver_id) REFERENCES independent_drivers(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pooling_group_bookings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  pooling_group_id BIGINT NOT NULL,
  booking_id BIGINT NOT NULL,
  stop_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pooling_booking (booking_id),
  INDEX idx_pooling_group_bookings_group (pooling_group_id),
  INDEX idx_pooling_group_bookings_order (stop_order),
  CONSTRAINT fk_pooling_group_bookings_group
    FOREIGN KEY (pooling_group_id) REFERENCES pooling_groups(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pooling_group_bookings_booking
    FOREIGN KEY (booking_id) REFERENCES independent_bookings(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE independent_bookings
  ADD CONSTRAINT fk_independent_bookings_pooling_group
  FOREIGN KEY (pooling_group_id) REFERENCES pooling_groups(id)
  ON DELETE SET NULL;
