"""
update_spi_batch.py
-------------------
Baca DATA SPI HANTAR INV 2 (1).xlsx dan UPDATE kolom:
  lat, lng, status, nama_kecamatan, nama_kabupaten,
  nama_pic_penerima, nomor_hp_pic, nama_kelurahan
di tabel batch_deliveries via POST /api/batch-delivery/update-bulk.

lat/lng diambil otomatis dari expedition_master_districts (server-side).

Cara pakai:
  python3 update_spi_batch.py
"""

import openpyxl
import json
import urllib.request
import urllib.error
import sys
import os

EXCEL_FILE = os.path.expanduser('~/Downloads/DATA SPI HANTAR INV 2 (1).xlsx')
API_BASE   = 'https://travel-api-production-23ae.up.railway.app'
CHUNK      = 100

def read_packages():
    print(f'📂 Membaca: {EXCEL_FILE}')
    wb = openpyxl.load_workbook(EXCEL_FILE, read_only=True, data_only=True)
    ws = wb['Sheet 1']

    packages = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        # A=NPP, B=NAMA_PERUSAHAAN, C=ALAMAT_PERUSAHAAN,
        # D=KODE_PROPINSI, E=NAMA_PROPINSI, F=KODE_KABUPATEN,
        # G=NAMA_KABUPATEN, H=KODE_KECAMATAN, I=NAMA_KECAMATAN,
        # J=NAMA_KECAMATAN_1, K=KODE_KELURAHAN, L=NAMA_KELURAHAN,
        # M=HANDPHONE_KONTAK, N=NAMA_KONTAK
        npp            = row[0]
        nama_kabupaten = row[6]
        kode_kecamatan = row[7]
        nama_kecamatan = row[8]
        nama_kelurahan = row[11]
        hp_kontak      = row[12]
        nama_kontak    = row[13]

        if not npp:
            continue

        npp_str  = str(int(npp)) if isinstance(npp, float) else str(npp).strip()
        kec_code = str(int(kode_kecamatan)) if isinstance(kode_kecamatan, (int, float)) else str(kode_kecamatan or '').strip()

        packages.append({
            'npp':              npp_str,
            'kode_kecamatan':   kec_code or None,
            'nama_kecamatan':   str(nama_kecamatan).strip() if nama_kecamatan else None,
            'nama_kabupaten':   str(nama_kabupaten).strip() if nama_kabupaten else None,
            'nama_kelurahan':   str(nama_kelurahan).strip() if nama_kelurahan else None,
            'nomor_hp_pic':     str(hp_kontak).strip() if hp_kontak else None,
            'nama_pic_penerima': str(nama_kontak).strip() if nama_kontak else None,
        })

    print(f'📊 Total data: {len(packages)} baris')
    return packages

def send_chunk(chunk, batch_num, total_batches):
    payload = json.dumps({'packages': chunk}).encode('utf-8')
    req = urllib.request.Request(
        f'{API_BASE}/api/batch-delivery/update-bulk',
        data=payload,
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.loads(res.read())
        updated   = data.get('data', {}).get('updated', 0)
        not_found = data.get('data', {}).get('not_found', 0)
        print(f'  Batch {batch_num}/{total_batches}: ✅ updated={updated}, not_found={not_found}')
        return updated, not_found
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'  Batch {batch_num}/{total_batches}: ❌ HTTP {e.code} — {body[:200]}')
        return 0, 0

def main():
    packages      = read_packages()
    total         = len(packages)
    total_batches = (total + CHUNK - 1) // CHUNK

    print(f'\n🚀 Mulai update {total} baris dalam {total_batches} batch...\n')

    total_updated   = 0
    total_not_found = 0

    for i in range(0, total, CHUNK):
        chunk     = packages[i:i + CHUNK]
        batch_num = i // CHUNK + 1
        upd, nf   = send_chunk(chunk, batch_num, total_batches)
        total_updated   += upd
        total_not_found += nf

    print(f'\n✅ Selesai!')
    print(f'   Updated   : {total_updated}')
    print(f'   Not found : {total_not_found} (NPP tidak ada di DB)')

if __name__ == '__main__':
    main()
