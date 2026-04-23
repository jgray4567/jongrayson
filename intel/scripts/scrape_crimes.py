import urllib.request
import json
import os
import ssl

def main():
    # Ignore SSL errors
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    import urllib.parse
    sql = "SELECT * from \"bd41992a-987a-4cca-8798-fbe1cd946b07\" WHERE \"ReportedDate\" >= '2024-01-01' ORDER BY \"ReportedDate\" DESC"
    url = "https://data.wprdc.org/api/3/action/datastore_search_sql?sql=" + urllib.parse.quote(sql)
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    
    try:
        response = urllib.request.urlopen(req, context=ctx)
        data = json.loads(response.read().decode('utf-8'))
        records = data.get('result', {}).get('records', [])
    except Exception as e:
        print(f"Error fetching data: {e}")
        return

    features = []
    for r in records:
        lat = r.get('YCOORD') or r.get('Y') or r.get('LATITUDE')
        lng = r.get('XCOORD') or r.get('X') or r.get('LONGITUDE')
        if not lat or not lng:
            continue
            
        desc = r.get('NIBRS_Coded_Offense') or r.get('INCIDENTHIERARCHYDESC') or r.get('OFFENSES') or 'Unknown'
        desc_lower = desc.lower() if desc else ''
        
        category = 'Other'
        if any(w in desc_lower for w in ['assault', 'robbery', 'murder', 'homicide', 'rape', 'threat', 'strangulation']):
            category = 'Violent'
        elif any(w in desc_lower for w in ['theft', 'burglary', 'stolen', 'mischief', 'trespass', 'fraud']):
            category = 'Property'
        elif any(w in desc_lower for w in ['drug', 'narcotic', 'marijuana']):
            category = 'Drug'
            
        # construct time
        rd = r.get('ReportedDate')
        rt = r.get('ReportedTime')
        time_str = f"{rd} {rt}" if rd and rt else r.get('INCIDENTTIME') or 'Unknown'

        zone_raw = r.get('Zone') or r.get('INCIDENTZONE') or 'Unknown'
        zone_str = str(zone_raw).replace('Zone ', '')
            
        try:
            lat_f = float(lat)
            lng_f = float(lng)
        except ValueError:
            continue
            
        features.append({
            'lat': lat_f,
            'lng': lng_f,
            'incident_type': desc,
            'category': category,
            'zone': zone_str,
            'time': time_str
        })
        
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'pittsburgh')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'daily_crimes.json')
    
    with open(out_path, 'w') as f:
        json.dump(features, f, indent=2)
        
    print(f"Scraped {len(features)} crimes to {out_path}")

if __name__ == '__main__':
    main()
