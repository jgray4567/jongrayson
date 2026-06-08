# A1A — AI-Powered Real Estate Automation Platform

**Status:** Active
**Type:** Client Website (SaaS Platform + Storefront)
**Domains:** `a1a.com` (main platform), `a1asells.com` (storefront/marketing)
**Legacy domain:** `exita1a.com` → redirects to `a1a.com`
**GitHub repos:**
- `jgray4567/exita1a-landing` — main site (a1a.com)
- `jgray4567/a1asells` — storefront (a1asells.com)

## Overview
A1A is an AI-powered real estate automation platform. Eliminates manual work, automates marketing, generates CMAs, listing management, agent productivity tools. Limited access for select agents and brokerages.

## Tech Stack
- Static HTML/CSS multi-page site
- GitHub Pages deployment
- Cloudflare DNS + SSL
- `exita1a.com` → `a1a.com` redirect via `_redirects` + CNAME
- Web Team VPS pipeline (`webteam-vps/manifests/sites/a1a-sells`)

## Site Pages (a1a.com)
- `index.html` — Main landing page with CTA
- `about.html` — About page
- `privacy.html` — Privacy policy
- `terms.html` — Terms of service
- `css/`, `js/`, `images/` — Assets

## Deployment
- Push to `jgray4567/exita1a-landing` → auto-deploys to a1a.com via GitHub Pages
- Push to `jgray4567/a1asells` → auto-deploys to a1asells.com via GitHub Pages
- Cloudflare handles DNS, SSL, and redirects

## Related
- Part of JK Web Team client portfolio
- See `JERRYKNOWS-WEB-TEAM.md` for full pipeline details
- Custom A1A sign image (may be on Google Drive — verify)