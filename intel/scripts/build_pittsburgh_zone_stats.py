import json
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX_PATH = ROOT / 'data' / 'pittsburgh' / 'incidents_2024_thru_mar2026.xlsx'
OUT_PATH = ROOT / 'data' / 'pittsburgh' / 'zone_crime_stats.json'

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
EXCEL_EPOCH = date(1899, 12, 30)


def col_letters(cell_ref: str) -> str:
    letters = []
    for ch in cell_ref:
        if ch.isalpha():
            letters.append(ch)
        else:
            break
    return ''.join(letters)


def create_bucket(zone: str):
    return {
        'zone': zone,
        'incidentCount': 0,
        'offenseTypes': Counter(),
        'offenseCategories': Counter(),
        'neighborhoods': Counter(),
        'crimeAgainst': Counter(),
    }


def parse_excel_year(serial_text: str):
    try:
        serial = int(float(serial_text))
    except Exception:
        return None
    return (EXCEL_EPOCH + timedelta(days=serial)).year


def parse_xlsx_rows(path: Path):
    with zipfile.ZipFile(path) as zf:
        sheet = ET.fromstring(zf.read('xl/worksheets/sheet1.xml'))
        rows = sheet.find(f'{NS}sheetData').findall(f'{NS}row')
        headers = {}

        def cell_text(cell):
            t = cell.get('t')
            if t == 'inlineStr':
                node = cell.find(f'{NS}is')
                if node is None:
                    return ''
                return ''.join(t.text or '' for t in node.iter(f'{NS}t'))
            v = cell.find(f'{NS}v')
            return '' if v is None else (v.text or '')

        for idx, row in enumerate(rows):
            values = {}
            for cell in row.findall(f'{NS}c'):
                values[col_letters(cell.get('r', ''))] = cell_text(cell)
            if idx == 0:
                headers = values
                continue
            yield {headers.get(col, col): value for col, value in values.items()}


def finalize_bucket(stats):
    return {
        'zone': stats['zone'],
        'incidentCount': stats['incidentCount'],
        'topOffenseTypes': stats['offenseTypes'].most_common(6),
        'topOffenseCategories': stats['offenseCategories'].most_common(6),
        'topNeighborhoods': stats['neighborhoods'].most_common(6),
        'crimeAgainst': stats['crimeAgainst'].most_common(6),
    }


zone_stats = {
    str(zone): {
        'all': create_bucket(str(zone)),
        'years': {}
    }
    for zone in range(1, 7)
}
years_seen = set()

for row in parse_xlsx_rows(XLSX_PATH):
    zone = str(row.get('Zone', '')).strip().replace('Zone ', '')
    if zone not in zone_stats:
        continue

    year = parse_excel_year(row.get('ReportedDate', ''))
    if year is not None:
        years_seen.add(str(year))

    targets = [zone_stats[zone]['all']]
    if year is not None:
        year_key = str(year)
        if year_key not in zone_stats[zone]['years']:
            zone_stats[zone]['years'][year_key] = create_bucket(zone)
        targets.append(zone_stats[zone]['years'][year_key])

    for stats in targets:
        stats['incidentCount'] += 1
        if row.get('NIBRS_Offense_Type'):
            stats['offenseTypes'][row['NIBRS_Offense_Type'].strip()] += 1
        if row.get('NIBRS_Offense_Category'):
            stats['offenseCategories'][row['NIBRS_Offense_Category'].strip()] += 1
        if row.get('Neighborhood'):
            stats['neighborhoods'][row['Neighborhood'].strip()] += 1
        if row.get('NIBRS_Crime_Against'):
            stats['crimeAgainst'][row['NIBRS_Crime_Against'].strip()] += 1

output = {
    'source': 'WPRDC Monthly Criminal Activity (2024-2026)',
    'years': sorted(years_seen),
    'zones': {}
}

for zone, buckets in zone_stats.items():
    output['zones'][zone] = {
        'zone': zone,
        'all': finalize_bucket(buckets['all']),
        'years': {year: finalize_bucket(stats) for year, stats in buckets['years'].items()}
    }

OUT_PATH.write_text(json.dumps(output, indent=2))
print(f'wrote {OUT_PATH}')
