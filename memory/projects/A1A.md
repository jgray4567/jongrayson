# A1A — Exit A1A

**Status:** Active
**Type:** Client Website (Landing Page)
**Domain:** `exita1a.com`
**GitHub:** `jgray4567/exita1a-landing`
**Also:** `a1asells` (separate storefront site)

## Overview
Exit A1A is a client landing page and brand site for A1A, a beach lifestyle / real estate venture. Features a custom A1A sign image, waitlist signup via mailto, social meta tags, and www→apex redirect via Cloudflare.

## Tech Stack
- Static HTML/CSS landing page
- Cloudflare DNS + SSL
- GitHub Pages deployment
- Web Team VPS pipeline (`webteam-vps/manifests/sites/a1a-sells`)

## Deployment
- Push to `jgray4567/exita1a-landing` on GitHub → auto-deploys
- Domain: `exita1a.com` (Cloudflare)
- Separate storefront: `a1asells` site manifest on VPS

## Related
- Part of JK Web Team client portfolio
- See `JERRYKNOWS-WEB-TEAM.md` for full pipeline details