# Panduan Lengkap: Master Data Lokasi Sumatera Barat

## 📋 Arsitektur Database

### Struktur Tabel

```
┌─────────────────────────┐
│  location_references    │  ← Master data lokasi
├─────────────────────────┤
│ id (PK)                 │
│ name                    │
│ type (city/regency/dist)│
│ parent_name             │
│ is_popular              │
│ is_active               │
└─────────────────────────┘
           ↑
           │ (referensi manual via name)
           │
┌─────────────────────────┐
│       travels           │  ← Rute perjalanan
├─────────────────────────┤
│ id (PK)                 │
│ po_id                   │
│ vehicle_id              │
│ origin ← VARCHAR(255)   │
│ destination ← VARCHAR   │
│ departure_time          │
│ price                   │
└─────────────────────────┘
```

### Data Locations (155 total)

**7 Kota:**
- Padang
- Bukittinggi
- Payakumbuh
- Solok
- Sawahlunto
- Padang Panjang
- Pariaman

**12 Kabupaten dengan 148 Kecamatan:**
- Kab. Agam (16)
- Kab. Dharmasraya (11)
- Kab. Kepulauan Mentawai (10)
- Kab. Lima Puluh Kota (13)
- Kab. Padang Pariaman (17)
- Kab. Pasaman (12)
- Kab. Pasaman Barat (11)
- Kab. Pesisir Selatan (15)
- Kab. Sijunjung (8)
- Kab. Solok (14)
- Kab. Solok Selatan (7)
- Kab. Tanah Datar (14)

---

## 🚀 Cara Deploy

### 1. Jalankan Migration Database

```bash
# Masuk ke folder travel_api
cd travel_api

# Set environment variables (Railway credentials)
export DB_PASSWORD="your_railway_password"

# Jalankan script seeding
node scripts/seed_locations.js
```

**Output yang diharapkan:**
```
🚀 Connecting to database...
✅ Connected to database
📄 SQL file loaded
📊 Found 157 SQL statements

🔨 Creating table location_references...
💾 Inserting data: 157/157

🔍 Running verification query...
[ { type: 'city', count: 7 }, { type: 'district', count: 148 } ]

✅ Migration completed successfully!
📊 Total locations inserted: 155 (7 cities + 148 districts)
🔌 Database connection closed

🎉 All done!
```

### 2. Test API Endpoint

```bash
# Get all locations
curl https://travel-api-production-23ae.up.railway.app/api/locations

# Search by name
curl "https://travel-api-production-23ae.up.railway.app/api/locations?search=Padang"

# Get only cities
curl "https://travel-api-production-23ae.up.railway.app/api/locations?type=city"

# Get popular locations only
curl "https://travel-api-production-23ae.up.railway.app/api/locations/popular"

# Get specific location by ID
curl https://travel-api-production-23ae.up.railway.app/api/locations/1
```

**Response format:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": 1,
      "name": "Padang",
      "type": "city",
      "parent_name": null,
      "is_popular": 1,
      "display_name": "Padang"
    },
    {
      "id": 8,
      "name": "Ampek Angkek",
      "type": "district",
      "parent_name": "Kab. Agam",
      "is_popular": 0,
      "display_name": "Ampek Angkek, Kab. Agam"
    }
  ]
}
```

---

## 📱 Integrasi Flutter

### Update home_screen.dart

```dart
// Tambahkan model Location
class Location {
  final int id;
  final String name;
  final String type;
  final String? parentName;
  final bool isPopular;
  final String displayName;

  Location({
    required this.id,
    required this.name,
    required this.type,
    this.parentName,
    required this.isPopular,
    required this.displayName,
  });

  factory Location.fromJson(Map<String, dynamic> json) {
    return Location(
      id: json['id'],
      name: json['name'],
      type: json['type'],
      parentName: json['parent_name'],
      isPopular: json['is_popular'] == 1,
      displayName: json['display_name'],
    );
  }
}

// Fungsi untuk fetch locations dari API
Future<List<Location>> fetchLocations(String query) async {
  try {
    final response = await http.get(
      Uri.parse('https://travel-api-production-23ae.up.railway.app/api/locations?search=$query&limit=20'),
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final locations = (data['data'] as List)
          .map((item) => Location.fromJson(item))
          .toList();
      return locations;
    }
    return [];
  } catch (e) {
    print('Error fetching locations: $e');
    return [];
  }
}

// Update TypeAheadField untuk origin
TypeAheadField<Location>(
  textFieldConfiguration: TextFieldConfiguration(
    controller: _originController,
    decoration: InputDecoration(
      labelText: 'Tempat Berangkat',
      prefixIcon: CircleAvatar(/* ... */),
    ),
  ),
  suggestionsCallback: (pattern) async {
    if (pattern.isEmpty) {
      // Show popular locations when empty
      final response = await http.get(
        Uri.parse('https://travel-api-production-23ae.up.railway.app/api/locations/popular'),
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return (data['data'] as List)
            .map((item) => Location.fromJson(item))
            .toList();
      }
      return <Location>[];
    }
    return await fetchLocations(pattern);
  },
  itemBuilder: (context, Location suggestion) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: suggestion.isPopular 
            ? Colors.orange.shade100 
            : Colors.blue.shade50,
        child: Icon(
          suggestion.type == 'city' 
              ? Icons.location_city 
              : Icons.location_on,
          color: suggestion.isPopular 
              ? Colors.orange 
              : Colors.blue,
        ),
      ),
      title: Text(
        suggestion.displayName,
        style: GoogleFonts.poppins(
          fontWeight: suggestion.isPopular 
              ? FontWeight.w600 
              : FontWeight.w400,
        ),
      ),
      subtitle: Text(
        suggestion.type == 'city' ? 'Kota' : 'Kecamatan',
        style: GoogleFonts.poppins(fontSize: 12),
      ),
    );
  },
  onSuggestionSelected: (Location suggestion) {
    setState(() {
      _originController.text = suggestion.displayName;
    });
  },
)
```

---

## 🔄 Workflow Lengkap

### Backend (Node.js + MySQL)
1. ✅ Tabel `location_references` menyimpan 155 lokasi Sumbar
2. ✅ API `/api/locations` untuk autocomplete dengan filter
3. ✅ API `/api/locations/popular` untuk quick suggestions
4. ✅ Tabel `travels` tetap menggunakan VARCHAR untuk origin/destination

### Frontend (Flutter)
1. ⏳ TypeAheadField fetch data dari API `/api/locations`
2. ⏳ Show popular locations saat field kosong
3. ⏳ Real-time search dengan query parameter
4. ⏳ Display dengan icon berbeda untuk city vs district

### User Flow
1. User tap field "Tempat Berangkat" → Show 10 popular locations
2. User ketik "bon" → API call `/api/locations?search=bon`
3. Show hasil: "Bonai Darussalam, Kab. Pasaman Barat"
4. User select → Save sebagai "Bonai Darussalam, Kab. Pasaman Barat" ke travels.origin

---

## 📊 Database Stats

| Metric | Value |
|--------|-------|
| Total Locations | 155 |
| Cities | 7 |
| Regencies | 12 (parent) |
| Districts | 148 |
| Popular Locations | ~20 (major cities + tourist areas) |
| SQL File Size | ~25 KB |
| Migration Time | ~2-3 seconds |

---

## 🎯 Next Steps

1. **Deploy Migration:**
   ```bash
   node scripts/seed_locations.js
   ```

2. **Test API:**
   ```bash
   curl https://travel-api-production-23ae.up.railway.app/api/locations/popular
   ```

3. **Update Flutter App:**
   - Replace hardcoded locations dengan API call
   - Implement TypeAheadField dengan Location model
   - Add loading states dan error handling

4. **Build & Test:**
   ```bash
   flutter build apk --release
   ```

---

## 📝 Files Created

```
travel_api/
├── migrations/
│   └── seed_sumbar_locations.sql         # CREATE TABLE + 155 INSERT statements
├── scripts/
│   └── seed_locations.js                 # Node.js script to execute migration
├── routes/
│   └── locations.js                      # API endpoints for locations
└── data_lokasi_sumbar.md                 # Documentation of all locations
```

**Ready to execute!** 🚀
