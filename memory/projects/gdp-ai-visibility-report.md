# GDP AI Visibility Report

**Category:** AI
**Status:** Active
**Main URL:** https://graysondp.com/ai-visibility-report.html

## Overview

Free AI Visibility Report — shows businesses how AI search engines (ChatGPT, Perplexity, Gemini) see them. Generates a visibility score, shows which engines mention the business, and provides actionable fixes. Lead magnet for GDP AEO services.

## What It Does

- Queries ChatGPT, Perplexity, and Gemini for brand mentions
- Generates AI visibility score
- Shows which AI engines recommend the business
- Identifies gaps and provides fix recommendations
- Free → upsells to AEO Services

## Architecture

- Frontend: `ai-visibility-report.html` (GDP design system, orange #e86e34)
- Backend: `ai-visibility-api/` — Express API server, queries OpenAI for brand visibility analysis
- CSS: `css/ai-visibility-report.css` — custom styles, --cyan remapped to #e86e34

## Pages

- `ai-visibility-report.html` — Report landing page (free)
- Badge currently hidden (visibility:hidden)

## Tech

- Static HTML/CSS frontend + Express.js API backend
- GDP design system (no blue, orange only)
- Deployed via lftp SFTP to NetworkSolutions
- Live on graysondp.com

## Local

`GraysonDP Dev/upload/ai-visibility-report.html`, `css/ai-visibility-report.css`
Backend: `ai-visibility-api/`