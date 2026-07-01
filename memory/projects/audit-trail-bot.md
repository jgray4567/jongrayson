# Audit Trail Bot

**Category:** AI
**Status:** Active

## Overview

Lightweight GitHub automation bot that creates immutable, structured audit trails for engineering activity. Sell-ready MVP.

## What It Does

- Captures GitHub event metadata (push/PR/workflow)
- Writes NDJSON audit records
- Generates human-readable daily summary
- Uploads audit artifacts from GitHub Actions

## Architecture

- Node.js bot
- `audit/` — Audit record storage
- `docs/` — Documentation
- GitHub Actions integration

## Local

`audit-trail-bot/` in workspace.