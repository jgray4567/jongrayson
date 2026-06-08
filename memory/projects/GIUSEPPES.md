# Giuseppe's Ristorante (giuseppesva.com)

**Category:** Website

## Overview
Restaurant website for Giuseppe's Ristorante Italiano in Haymarket, VA. Family-owned Italian restaurant, est. 1982.

## URLs & Deployment
- **Live site:** https://www.giuseppesva.com
- **GitHub repo:** `https://github.com/jgray4567/giuseppesva-site` (remote `origin`)
- **Deploy:** GitHub Pages (auto-deploys from `main` branch)
- **CNAME:** `giuseppesva.com`

## Structure
- `index.html` — Homepage
- `about.html` — Our Story
- `menu.html` — Menu (dynamic, JS-driven)
- `dining.html` — Dining/Banquet info
- `events.html` — Events & Catering (dynamic, JS-driven from `events.json`)
- `contact.html` — Contact info
- `speakeasy.html` — Dopo Ora (speakeasy bar)
- `assets/css/` — `base.css` (shared), page-specific CSS files
- `assets/js/` — `events.js`, `menu.js`, `speakeasy-events.js`, page scripts
- `assets/images/` — Photos, logos, icons
- `events.json` — Event data (scraped from Facebook, manually updated)
- `automation/` — `sync_readonly.py` (content sync agent)
- `automation/reports/` — Sync reports

## Events System
- `events.json` — Array of event objects: `{date, parsedDate, title, description, url}`
- `events.js` fetches `events.json?v=timestamp` on page load
- Groups events by month, renders month tab buttons
- Tab buttons styled as horizontal pills above event cards
- Event cards in 2-column grid on desktop (≥700px), single column on mobile
- Past events automatically filtered out
- Scraper: `get-giuseppes-snapshot.js` (uses agent-browser + Gemini CLI, currently broken due to missing Gemini auth)
- Manual update: scrape Facebook page, parse events, update `events.json`, commit & push

## Design
- Dark theme (charcoal/ink background, gold/cream text)
- Fonts: Playfair Display (display), Cormorant Garamond (body), IM Fell English (accent)
- Fixed nav header, hamburger menu on mobile
- Color vars: `--gold`, `--gold-light`, `--cream`, `--parchment`, `--crimson`
- Banquet photo lightbox with prev/next navigation
- Facebook event links throughout

## Special Notes
- **Group chat rule:** In the Telegram group chat with Sal, my scope is strictly limited to **menu changes only**
- Facebook page: `https://www.facebook.com/giuseppesri`
- Phone: 703-753-1004
- Address: 15120 Washington St, Haymarket, VA 20169
- Dopo Ora speakeasy bar inside Giuseppe's