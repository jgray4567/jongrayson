# One Hot Mess (onehotmess.band)

## Overview
Band website for One Hot Mess — a music group performing at venues around Virginia.

## URLs & Deployment
- **Live site:** https://www.onehotmess.band
- **GitHub repo:** `https://github.com/jgray4567/onehotmess` (remote `origin`)
- **Deploy:** GitHub Pages (auto-deploys from `main` branch)
- **CNAME:** `www.onehotmess.band`

## Structure
- `index.html` — Single-page site
- `style.css` — All styles
- `script.js` — Main JS
- `hero-particles.js` — Particle animation in hero
- `events.js` — Dynamic events rendering from `events.json`
- `events.json` — Event data (scraped from Facebook)
- `assets/` — Band logos, photos (OHM_*, GDP-Logo.png)
- `robots.txt`, `sitemap.xml`, `site.webmanifest`
- Favicon set (android-chrome, apple-touch-icon, favicon.ico)

## Events System
- `events.json` — Array of event objects: `{date, parsedDate, title, venue, location, url}`
- Events include venue and location (unlike Giuseppe's)
- `events.js` — Dynamic events fetcher with month-tab grouping
  - **<10 events:** flat list (original show-card layout)
  - **10+ events:** grouped by month with tab buttons (styled in OHM's cyan/teal palette)
- Scraper: `get-onehotmess-snapshot.js` (uses agent-browser)
- Facebook page: `https://www.facebook.com/profile.php?id=100062739473361`

## Key Venues (from events data)
- Old Bust Head Brewing Company (Warrenton, VA)
- Jimmy's Old Town Tavern (Herndon, VA)
- The Winery At Sunshine Ridge Farm (Gainesville, VA)
- The Farm Brewery at Broad Run

## Design
- Modern single-page layout with particle hero animation
- Band branding: OHM caps logo, GDP logo
- Self-contained (no framework dependencies beyond custom JS)