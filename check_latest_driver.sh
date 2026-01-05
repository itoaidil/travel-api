#!/bin/bash
mysql -h turntable.proxy.rlwy.net -P 3306 -u root -pMJxeJYgDinXJPgEsKCUlbBIaIqywPbbs railway << 'SQL'
SELECT 
  u.id as user_id,
  u.username,
  u.phone,
  u.email,
  u.user_type,
  u.is_active,
  u.created_at as user_created,
  d.id as driver_id,
  d.vehicle_type,
  d.vehicle_color,
  d.vehicle_year,
  d.vehicle_plate,
  d.license_number,
  d.stnk_number,
  d.is_verified,
  d.status
FROM users u
LEFT JOIN independent_drivers d ON u.id = d.user_id
WHERE u.user_type = 'driver'
ORDER BY u.created_at DESC
LIMIT 3;
SQL
