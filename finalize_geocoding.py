import openpyxl
import csv
import json

EXCEL_FILE = '/Users/fitroaidil/Downloads/ALAMAT.xlsx'
PROGRESS_FILE = '/Users/fitroaidil/Documents/hantar_apps/travel_api/geocode_progress.json'
OUTPUT_FILE = '/Users/fitroaidil/Documents/hantar_apps/travel_api/output_geocoded.csv'

wb = openpyxl.load_workbook(EXCEL_FILE)
ws = wb.active

progress = json.load(open(PROGRESS_FILE))

all_rows = []
for row in ws.iter_rows(min_row=6, values_only=True):
    col_no, npp, alamat = row[1], row[2], row[3]
    if npp and alamat and str(alamat).strip():
        key = str(int(npp)) if isinstance(npp, float) else str(npp)
        all_rows.append({
            'no': str(col_no or ''),
            'npp': key,
            'address': str(alamat).strip()
        })

with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['no', 'npp', 'address', 'lat', 'lng'])
    writer.writeheader()
    for pkg in all_rows:
        geo = progress.get(pkg['npp'], {})
        lat = geo.get('lat') or '0'
        lng = geo.get('lng') or '0'
        writer.writerow({
            'no': pkg['no'],
            'npp': pkg['npp'],
            'address': pkg['address'],
            'lat': lat,
            'lng': lng
        })

total = len(all_rows)
success = sum(1 for p in all_rows if progress.get(p['npp'], {}).get('lat'))
zero = total - success
print(f'CSV final ditulis: {OUTPUT_FILE}')
print(f'Total: {total} | Koordinat valid: {success} | Koordinat 0,0: {zero}')
