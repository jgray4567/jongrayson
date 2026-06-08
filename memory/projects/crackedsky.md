# Cracked Sky (crackedsky.band)

## Overview
Band website for Cracked Sky — a music group performing at venues around Virginia.

## URLs & Deployment
- **Live site:** https://www.crackedsky.band
- **GitHub repo:** `https://github.com/jgray4567/crackedsky` (remote `origin`)
- **Deploy:** GitHub Pages (auto-deploys from `main` branch)
- **CNAME:** `www.crackedsky.band`

## Structure
- `index.html` — Main page
- `css/styles.css` — Stylesheets
- `js/main.js` — Main JS
- `js/events.js` — Dynamic events rendering from `events.json`
- `events.json` — Event data
- `assets/img/` — Band photos (CS001.jpg, CrackedSky001-008.jpg, video mp4)
- `scripts/scrape_events.py` — Python event scraper (Playwright + BeautifulSoup)
- `requirements.txt` — Python deps: playwright, beautifulsoup4, lxml, dateparser
- `.github/workflows/scrape-events.yml` — GitHub Actions auto-scraper

## Events System
- `events.json` — Array of: `{date, parsedDate, title, venue, location, url}`
- Events include venue and location
- `events.js` — Dynamic events fetcher with month-tab grouping
  - **<10 events:** flat list (original show-row layout)
  - **10+ events:** grouped by month with tab buttons (styled in CS's gold/parchment palette)
- **Auto-scraper:** GitHub Actions workflow (`scrape-events.yml`) runs `scripts/scrape_events.py`
  - Uses Playwright headless browser with mobile user-agent
  - Navigates to Facebook events page, extracts event data
  - Commits updated `events.json` to repo (auto-deploys via GitHub Pages)

## Design
- Clean layout with band imagery
- Photos and video in assets
- Python-based scraper (unlike other sites which use agent-browser + Gemini)