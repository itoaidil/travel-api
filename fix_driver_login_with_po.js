// Query untuk test di DBeaver dulu
console.log(`
-- Cek struktur table drivers
DESCRIBE drivers;

-- Cek driver yang punya po_id
SELECT * FROM drivers WHERE po_id IS NOT NULL LIMIT 5;

-- Cek driver 'asldfkasdfla' dengan po_id 67
SELECT * FROM drivers WHERE license_number = 'IZA1231231';

-- Query login yang benar (JOIN dengan users berdasarkan license_number sebagai phone?)
-- Atau mungkin ada mapping lain?
`);
