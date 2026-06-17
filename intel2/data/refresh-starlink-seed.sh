#!/bin/bash
# Refresh Starlink TLE seed data from CelesTrak (runs from local machine)
SEED_DIR="$(cd "$(dirname "$0")" && pwd)"
SEED_FILE="$SEED_DIR/starlink-seed.json"
TLE_FILE=$(mktemp)

# Fetch Starlink TLE data
curl -sf 'https://celestrak.org/NORAD/elements/gp.php?NAME=starlink&FORMAT=tle' -o "$TLE_FILE"

if [ $? -ne 0 ] || [ ! -s "$TLE_FILE" ]; then
    echo "ERROR: Failed to fetch Starlink TLE data"
    rm -f "$TLE_FILE"
    exit 1
fi

# Parse TLE data into JSON seed file using Python
python3 << PYEOF
import json, math, re

with open("$TLE_FILE", "r") as f:
    lines = f.read().strip().split("\\n")

mu = 398600.4418
earth_radius = 6378.137
items = []

i = 0
count = 0
while i + 2 < len(lines) and count < 120:
    name = lines[i].strip()
    tle1 = lines[i+1].strip()
    tle2 = lines[i+2].strip()
    i += 3
    
    if not name or not tle1.startswith("1 ") or not tle2.startswith("2 "):
        continue
    
    try:
        inclination = float(tle2[8:16].strip())
        mean_motion = float(tle2[52:63].strip())
        if mean_motion <= 0:
            continue
        period_minutes = 1440.0 / mean_motion
        mean_motion_rad = mean_motion * 2 * math.pi / 86400.0
        semi_major = (mu / (mean_motion_rad ** 2)) ** (1/3)
        altitude = max(0, semi_major - earth_radius)
        norad_id = tle1[2:7].strip()
        orbit_class = "GEO" if altitude >= 35000 else ("MEO" if altitude >= 2000 else "LEO")
        
        items.append({
            "name": name,
            "network": "SpaceX Starlink",
            "orbitClass": orbit_class,
            "inclination": round(inclination, 1),
            "periodMinutes": round(period_minutes, 1),
            "altitudeKm": round(altitude),
            "noradId": norad_id,
            "tle1": tle1,
            "tle2": tle2
        })
        count += 1
    except (ValueError, IndexError):
        continue

seed = {
    "count": len(items),
    "items": items,
    "source": "CelesTrak NAME=starlink (local refresh)",
    "updatedAt": __import__("time").time()
}

with open("$SEED_FILE", "w") as f:
    json.dump(seed, f, indent=2)

print(f"Updated {len(items)} Starlink satellites in seed file")
PYEOF

rm -f "$TLE_FILE"

# Commit and push the updated seed file
cd "$SEED_DIR/../.." && git add intel/data/starlink-seed.json && git commit -m "data: refresh Starlink TLE seed" && git push origin main
