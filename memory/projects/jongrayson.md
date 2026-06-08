# Jon Grayson Website (jongrayson.com)

## Overview
Jon's personal portfolio/consulting site — UX Strategist & AI Consultant, Washington DC.

## URLs & Deployment
- **Live site:** https://www.jongrayson.com (also jongrayson.com)
- **GitHub repo:** `https://github.com/jgray4567/jongrayson.git` (remote `origin`)
- **Deploy:** SFTP to DreamHost (`iad1-shared-b8-08.dreamhost.com`, user `dh_9geaer`, path `jongrayson.com`)
- **GitHub Actions:** Auto-deploys crime data daily via FTP (`.github/workflows/update-crime-data.yml`, cron `0 8 * * *`)
- **Google Analytics:** `G-L9JD3QE0J0`

## Structure
- `index.html` — Homepage (bundler-packed, single HTML file with all CSS/JS inline)
- `intel/` — Intelligence Layer (globe + crime map)
  - `intel/index.html`, `shell.js`, `styles.css` — Main intel page
  - `intel/api/` — PHP APIs (air-traffic, satellite-tracker, baseline, signal, etc.)
  - `intel/api/satellite-tracker.php` — CelesTrak satellite data, 400 sats max, LEO/MEO/GEO classification
  - `intel/data/pittsburgh/` — Crime data JSON, zone stats, GeoJSON
  - `intel/scripts/` — Python scrapers (scrape_crimes.py, build_pittsburgh_zone_stats.py)
- `lessons/` — AI Playbook (8 workflows, bundled HTML)
- `php/` — Contact form handler

## Intel Layer Features
- 3D globe (three-globe) with cities, crime markers, air traffic, satellites
- Crime map (Leaflet) with month selector, zone toggle, category legend (Violent/Property/Drug/Other)
- Satellite layer: LEO (green), MEO (cyan), GEO (red) with toggle filters
- Air traffic layer with live ADS-B planes
- Single-row nav: Home | Intel | Air | Sat | LEO/MEO/GEO filters | Zones | Month | Globe | Rotate
- Pittsburgh crime data from WPRDC SQL API (resource `bd41992a-987a-4cca-8798-fbe1cd946b07`)

## Key CSS/JS Variables
- `pittsburghCrimesData`, `pittsburghCrimesLayer`, `pittsburghSelectedMonth`
- `pittsburghVisibleCategories = new Set(['Violent','Property','Drug','Other'])`
- `pittsburghVisibleOrbits = new Set(['LEO','MEO','GEO'])`
- `satelliteLayerEnabled`, `currentSatelliteCatalog`, `airLayerEnabled`
- Color scheme: lime `#C4D600`, near-black `#1d1d1f`, off-white `#f5f5f7`

## Homepage Design
- Apple-inspired dark/light sections, lime accent color
- Scroll animations, letter-split hero, floating shapes
- Visitor Intelligence dashboard (scroll depth, time, device info)
- Contact form → `php/contact-me.php`
- "Intel Layer →" and "AI Playbook →" hero buttons