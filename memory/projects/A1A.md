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

## Google Drive Assets
**Folder:** https://drive.google.com/drive/folders/1GjxR8yDlnVwu1esCBj9osAq2F5EPGosz

### Subfolders
- `a1a-website/` — Website source/assets
- `Images/` — Image assets
- `NEW Items/` — Latest additions
- `Screenshots/` — Reference screenshots

### Key Documents (28 files total)
- A1A Agent PRD - Workflows & Feature Specifications v1.0 (docx + pdf)
- A1A Agent UI Component Inventory v1
- A1A AI Automation Playbook - Agent Workflow Automation Roadmap v1.0 (docx + pdf)
- A1A Cloud Team One - Consolidated Conversation Report
- A1A Cloud Team One - Execution Tracker (xlsx)
- A1A Competitive Teardown v1 - Zillow Realtor Redfin
- A1A Design Guide v1 (Research-Based)
- A1A Design Handoff Pack v1
- A1A Design QA Scorecard v1
- A1A Development Handoff Pack v1 (216KB)
- A1A Document Validation & Compliance Auditing Engine v1.0
- A1A Feature Visual Workflow Descriptions v1
- A1A Figma Feature Prompts v1 (NoVA)
- A1A Figma Make Superprompt v2 (Grounded)
- A1A Figma Make Superprompt v3 - Agent + Realtor Modules
- A1A Figma-to-Production Enterprise Plan v1
- A1A Geography Correction Notice v1 (NoVA)
- A1A Hosting Decision Matrix - DreamHost vs Modern Stack
- A1A Lean MVP Setup Checklist (213KB)
- A1A MLS Access Checklist + Data Source Policy
- A1A NoVA Feature Spec Map v1

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
- `css/`, `js/`, `images/` — Assets including `a1a-logo.png`

## Deployment
- Push to `jgray4567/exita1a-landing` → auto-deploys to a1a.com via GitHub Pages
- Push to `jgray4567/a1asells` → auto-deploys to a1asells.com via GitHub Pages
- Cloudflare handles DNS, SSL, and redirects

## Related
- Part of JK Web Team client portfolio
- See `JERRYKNOWS-WEB-TEAM.md` for full pipeline details