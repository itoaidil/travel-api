"""
import_villages.py
------------------
Baca DATA MASTER PROPINSI HINGGA KECAMATAN.xlsx dan import
data kelurahan/desa ke expedition_master_villages via Railway API.

Cara pakai:
  python3 import_villages.py

Duplikat kode kelurahan akan di-update otomatis (UPSERT).
"""

import openpyxl
import json
import urllib.request
import urllib.error
import sys
import os

EXCEL_FILE = os.path.expanduser('~/Downloads/DATA MASTER PROPINSI HINGGA KECAMATAN.xlsx')
API_BASE   = 'https://travel-api-production-23ae.up.railway.app'
CHUNK      = 500  # max 1000 per request, pakai 500 agar aman

def get_token():
    payload = json.dumps({'username': 'admin', 'password': 'hantar123'}).encode()
    req = urllib.request.Request(
        f'{API_BASE}/api/expedition/admin/login',
        data=payload,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        data = json.loads(res.read())
    token = data.get('data', {}).get('token') or data.get('token')
    if not token:
        print('❌ Login gagal:', data)
        sys.exit(1)
    print('✅ Login berhasil')
    return token

def read_villages_from_excel():
    print(f'📂 Membaca file: {EXCEL_FILE}')
    wb = openpyxl.load_workbook(EXCEL_FILE, read_only=True, data_only=True)
    ws = wb['Sheet 1']

    seen = {}  # code -> (district_code, name) — deduplicate
    for row in ws.iter_rows(min_row=2, values_only=True):
        # Kolom: A=KODE_PROPINSI, B=NAMA_PROPINSI, C=KODE_KABUPATEN, D=NAMA_KABUPATEN
        #        E=KODE_KECAMATAN, F=NAMA_KECAMATAN, G=KODE_KELURAHAN, H=NAMA_KELURAHAN
        kode_kecamatan = row[4]
        kode_kelurahan = row[6]
        nama_kelurahan = row[7]

        if not kode_kelurahan or not nama_kelurahan or not kode_kecamatan:
            continue

        code          = str(int(kode_kelurahan)) if isinstance(kode_kelurahan, float) else str(kode_kelurahan).strip()
        district_code = str(int(kode_kecamatan)) if isinstance(kode_kecamatan, float) else str(kode_kecamatan).strip()
        name          = str(nama_kelurahan).strip()

        if code not in seen:
            seen[code] = {'code': code, 'district_code': district_code, 'name': name}

    villages = list(seen.values())
    print(f'📊 Total kelurahan unik: {len(villages)}')
    return villages

def send_chunk(token, chunk, batch_num, total_batches):
    payload = json.dumps({'villages': chunk}).encode('utf-8')
    req = urllib.request.Request(
        f'{API_BASE}/api/expedition/admin/import-villages',
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.loads(res.read())
        inserted = data.get('data', {}).get('inserted', 0)
        print(f'  Batch {batch_num}/{total_batches}: ✅ {inserted} kelurahan')
        return inserted
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'  Batch {batch_num}/{total_batches}: ❌ HTTP {e.code} — {body[:200]}')
        return 0

def check_status(token):
    req = urllib.request.Request(
        f'{API_BASE}/api/expedition/admin/villages-status',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        data = json.loads(res.read())
    total = data.get('data', {}).get('villages', 0)
    print(f'\n📦 Total kelurahan di database: {total}')

def main():
    token    = get_token()
    villages = read_villages_from_excel()

    total        = len(villages)
    total_batches = (total + CHUNK - 1) // CHUNK
    total_inserted = 0

    print(f'\n🚀 Mulai import {total} kelurahan dalam {total_batches} batch...\n')

    for i in range(0, total, CHUNK):
        chunk     = villages[i:i + CHUNK]
        batch_num = i // CHUNK + 1
        total_inserted += send_chunk(token, chunk, batch_num, total_batches)

    print(f'\n✅ Selesai! Total terimport: {total_inserted} kelurahan')
    check_status(token)

if __name__ == '__main__':
    main()
