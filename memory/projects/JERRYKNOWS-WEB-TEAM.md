# JerryKnows Web Team

## Overview
Separate app at `https://api.jerryknows.ai`, distinct from `jerryknows-ai` and `bogleai.jerryknows.ai`.

## Status
Local MVP and VPS deployment were completed.

## Implemented
- end-to-end pipeline for inspect -> plan -> edit -> approve -> commit -> push
- Telegram approval flow with dedicated bot `@jk_webteam_bot`
- nginx + Let's Encrypt + pm2 deployment on VPS
- GitHub SSH auth on VPS for native push
- prompt-first UI design

## Repos / sites handled
- `exita1a-landing`
- `a1asells`
- `giuseppesva-site`
- `pickleops-investor-site`
- `databadger`

## Planned Agents / Watchers
- **Giuseppe's GitOps Event Watcher:** An agent designed to monitor Giuseppe's Facebook page, use Gemini 2.5 Flash to extract structured event data, auto-delete expired events, and push updates directly to the static site's `events.json` via GitHub. This avoids needing a traditional database or CMS. Awaiting the GitHub repo link and a decision on Facebook ingestion (Admin Token vs Apify/RSS scraper).
- Jon explicitly sees the Giuseppe watcher as a **proof of concept** that can be reused on at least one other project, so it should be built as a reusable Web Team pattern rather than a one-off script.

## Important infrastructure
- public URL: `https://api.jerryknows.ai`
- local URL: `http://localhost:8787`
- deploy path and VPS notes live in `TOOLS.md`
