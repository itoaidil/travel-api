"""
geocode_and_update_spi.py
-------------------------
Geocode kecamatan dari DATA SPI HANTAR INV 2 (1).xlsx menggunakan Nominatim
lalu UPDATE lat/lng di batch_deliveries.

Hanya geocode per kecamatan unik (57 kecamatan), bukan per baris.
Rate limit Nominatim: 1 req/detik.

Cara pakai:
  python3 geocode_and_update_spi.py
"""

import openpyxl
import json
import urllib.request
import urllib.parse
import urllib.error
import time
import os

EXCEL_FILE = os.path.expanduser('~/Downloads/DATA SPI HANTAR INV 2 (1).xlsx')
API_BASE   = 'https://travel-api-production-23ae.up.railway.app'
CHUNK      = 100

def geocode(nama_kecamatan, nama_kabupaten, nama_propinsi):
    """Geocode kecamatan via Nominatim. Return (lat, lng) atau (0,0)."""
    queries = [
        f"Kecamatan {nama_kecamatan}, {nama_kabupaten}, {nama_propinsi}, Indonesia",
        f"{nama_kecamatan}, {nama_kabupaten}, Indonesia",
        f"{nama_kecamatan}, {nama_propinsi}, Indonesia",
    ]
    for q in queries:
        url = 'https://nominatim.openstreetmap.org/search?q=' + urllib.parse.quote(q) + '&format=json&limit=1&countrycodes=id'
        req = urllib.request.Request(url, headers={'User-Agent': 'HantarDelivery/1.0 batch-geocode'})
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                data = json.loads(res.read())
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
        except Exception:
            pass
        time.sleep(1)  # rate limit
    return 0.0, 0.0

def read_packages():
    print(f'📂 Membaca: {EXCEL_FILE}')
    wb = openpyxl.load_workbook(EXCEL_FILE, read_only=True, data_only=True)
    ws = wb['Sheet 1']

    packages = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        npp            = row[0]
        nama_propinsi  = row[4]
        nama_kabupaten = row[6]
        nama_kecamatan = row[8]
        if not npp: continue
        npp_str = str(int(npp)) if isinstance(npp, float) else str(npp).strip()
        packages.append({
            'npp':           npp_str,
            'nama_kecamatan': str(nama_kecamatan or '').strip(),
            'nama_kabupaten': str(nama_kabupaten or '').strip(),
            'nama_propinsi':  str(nama_propinsi or '').strip(),
        })
    return packages

def update_latlng(npp_list, lat, lng):
    """UPDATE lat/lng untuk sebuah daftar NPP."""
    payload = json.dumps({'packages': [{'npp': npp, 'lat': lat, 'lng': lng} for npp in npp_list]}).encode()
    req = urllib.request.Request(
        f'{API_BASE}/api/batch-delivery/update-latlng',
        data=payload,
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return json.loads(res.read()).get('data', {}).get('updated', 0)
    except urllib.error.HTTPError as e:
        print(f'    ❌ HTTP {e.code}: {e.read().decode()[:100]}')
        return 0

def main():
    packages = read_packages()

    # Kelompokkan NPP per kecamatan unik
    kec_groups = {}
    for pkg in packages:
        key = (pkg['nama_kecamatan'], pkg['nama_kabupaten'], pkg['nama_propinsi'])
        kec_groups.setdefault(key, []).append(pkg['npp'])

    print(f'📊 Total baris    : {len(packages)}')
    print(f'📍 Kecamatan unik : {len(kec_groups)}')
    print(f'\n🚀 Mulai geocoding + update...\n')

    total_updated = 0
    for i, ((kec, kab, prov), npp_list) in enumerate(kec_groups.items(), 1):
        print(f'  [{i}/{len(kec_groups)}] Geocoding: {kec}, {kab}...', end=' ', flush=True)
        lat, lng = geocode(kec, kab, prov)
        if lat == 0 and lng == 0:
            print(f'⚠️  tidak ditemukan (skip lat/lng)')
            continue
        print(f'→ ({lat:.5f}, {lng:.5f})', end=' ')

        # Update semua NPP dalam grup ini
        upd = update_latlng(npp_list, lat, lng)
        print(f'→ updated {upd} rows')
        total_updated += upd
        time.sleep(1)  # jaga rate limit Nominatim

    print(f'\n✅ Selesai! Total baris diupdate lat/lng: {total_updated}')

if __name__ == '__main__':
    main()
