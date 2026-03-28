"""
import_to_db.py
---------------
Baca output_geocoded.csv dan kirim ke Railway API endpoint
POST /api/batch-delivery/import dalam batch 100 baris per request.

Cara pakai:
  python3 import_to_db.py

Jika ada error koneksi / server, script bisa dijalankan ulang —
NPP yang sudah masuk DB akan di-skip otomatis (UNIQUE KEY npp).
"""

import csv
import json
import urllib.request
import urllib.error
import os

GEOCODED_CSV = os.path.join(os.path.dirname(__file__), 'output_geocoded.csv')
API_BASE     = 'https://travel-api-production-23ae.up.railway.app'
CHUNK        = 100

def import_batch():
    packages = []
    with open(GEOCODED_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('address') and row['address'] != '#ERROR!':
                packages.append({
                    'no':      row.get('no', ''),
                    'npp':     row.get('npp', ''),
                    'address': row['address'],
                    'lat':     row.get('lat') or '0',
                    'lng':     row.get('lng') or '0',
                    'nama_pic_penerima': row.get('nama_pic_penerima') or row.get('nama_pic') or row.get('nama pic penerima') or '',
                    'nomor_hp_pic': row.get('nomor_hp_pic') or row.get('no_hp_pic') or row.get('nomor hp pic') or '',
                })

    total_pkgs = len(packages)
    no_coords  = sum(1 for p in packages if float(p['lat']) == 0 or float(p['lng']) == 0)
    print(f'Total paket akan diimport : {total_pkgs}')
    print(f'Koordinat valid           : {total_pkgs - no_coords}')
    print(f'Koordinat 0,0 (cari manual): {no_coords}')
    print(f'API target                : {API_BASE}/api/batch-delivery/import\n')

    success_total = 0
    skipped_total = 0
    error_total   = 0
    total_batches = (total_pkgs + CHUNK - 1) // CHUNK

    for i in range(0, total_pkgs, CHUNK):
        chunk     = packages[i:i + CHUNK]
        batch_num = i // CHUNK + 1

        payload = json.dumps({'packages': chunk}).encode('utf-8')
        req = urllib.request.Request(
            f'{API_BASE}/api/batch-delivery/import',
            data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )

        try:
            response = urllib.request.urlopen(req, timeout=60)
            result   = json.loads(response.read().decode('utf-8'))
            d        = result.get('data', {})
            ins      = d.get('inserted', 0)
            skip     = d.get('skipped_duplicate', 0)
            errs     = d.get('errors', [])

            success_total += ins
            skipped_total += skip
            error_total   += len(errs)

            print(f'[Batch {batch_num}/{total_batches}] '
                  f'inserted: {ins}, skip: {skip}, error: {len(errs)}')
            for e in errs[:3]:
                print(f'  ERROR: {e}')

        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='replace')
            print(f'[Batch {batch_num}/{total_batches}] HTTP {e.code}: {body[:200]}')
            error_total += len(chunk)
        except Exception as e:
            print(f'[Batch {batch_num}/{total_batches}] FAILED: {e}')
            error_total += len(chunk)

    print('\n' + '='*50)
    print('IMPORT SELESAI!')
    print(f'  Berhasil insert : {success_total}')
    print(f'  Skip (duplikat) : {skipped_total}')
    print(f'  Error           : {error_total}')

if __name__ == '__main__':
    import_batch()
