# Reusable Pattern: Band Site Facebook Events Scraper

**Category:** Other

**Date Added:** 2026-04-21
**Origin:** Developed for `onehotmess` and `crackedsky` repositories.

## Overview
A zero-cost, serverless architecture to scrape Facebook events and display them on static band websites (like GitHub Pages).

## Architecture

### 1. Data Source (`events.json`)
A static JSON file acting as the database.
```json
[
  {
    "title": "Season Opener!",
    "date": "2026-05-10 at 8:00 PM",
    "venue": "The Local Pub",
    "location": "City, State",
    "url": "https://facebook.com/events/123456"
  }
]
```

### 2. Frontend (`index.html` & `events.js`)
*   **HTML:** Includes a placeholder container: `<div id="events-fallback" class="shows-list"></div>`
*   **JS:** `events.js` fetches `events.json?v=[timestamp]` to bust cache, parses dates, filters out past events, sorts chronologically, and dynamically injects the HTML markup for each show.

### 3. Automated Scraper (Python + Playwright)
*   **Location:** `scripts/scrape_events.py`
*   **Logic:** Uses Playwright to load `https://m.facebook.com/[BandPage]/events` (mobile site is often easier to scrape and less aggressively blocked than desktop). It extracts the event titles, dates, locations, and URLs, then overwrites `events.json`.
*   **Dependencies:** `requirements.txt` with `playwright` and `beautifulsoup4` (if parsing DOM manually).

### 4. GitHub Actions Cron Job
*   **Location:** `.github/workflows/scrape-events.yml`
*   **Schedule:** Runs daily (e.g., `cron: '0 8 * * *'` for 8 AM UTC).
*   **Steps:**
    1. Checkout repo.
    2. Setup Python & install dependencies (`pip install -r requirements.txt`, `playwright install chromium`).
    3. Run scraper script.
    4. Check for changes (`git status`).
    5. Commit and push back to the repository using a standard GitHub action bot or personal access token.

## Usage
When setting up a new band site, clone this architecture:
1. Add `events.json` and `events.js`.
2. Add the UI container to the site's layout.
3. Drop in the Python scraper and adjust the target Facebook URL.
4. Add the GitHub Action workflow.