# ATLAS Audit as a Service

**Category:** AI
**Status:** In Development
**Main URL:** https://atlasaudit.ai

## Overview

ATLAS Audit is a SaaS product that maps AI agent stacks against the MITRE ATLAS framework (Adversarial Threat Landscape for AI Systems). Users complete an 8-question questionnaire about their AI deployment and receive a prioritized security report with all matched adversarial techniques, mitigation gaps, and an action plan.

## Architecture

- **Frontend:** Static HTML/CSS/JS (GDP design system — orange #e86e34, gray, dark)
- **Backend:** FastAPI (Python) on port 8795, PM2 managed
- **Database:** PostgreSQL `atlas_audit`
- **Reports:** ReportLab PDF generation + ATLAS Navigator layer JSON export
- **Payments:** Stripe Checkout ($99 full audit, $299 walkthrough)
- **Email:** Resend for PDF delivery
- **Deploy:** Hetzner VPS, Nginx reverse proxy, Cloudflare DNS

## Pricing

- Free teaser: Top 3 critical findings
- $99: Full audit report (all 173 techniques, 35 mitigations, action plan, PDF + Navigator)
- $299: Full audit + 30-min walkthrough call

## Data Source

MITRE ATLAS v2026.06 — 16 tactics, 173 techniques, 35 mitigations, 63 case studies.
YAML at `github-repos/mitre-atlas/atlas-data/dist/v6/ATLAS-2026.06.yaml`

## Related

- PRDs: `prd-atlas-audit-service.md`, `prd-agent-guardrail-sdk.md`, `prd-atlas-navigator-saas.md`
- Security scripts: `scripts/memory_integrity.py`, `scripts/prompt_injection_detector.py`, `scripts/credential_vault.py`
- AI BOM: `memory/projects/ai-bom.md`
- ATLAS audit notes: `memory/projects/atlas-security-audit.md`

## GitHub

Repo: `jgray4567/atlas-audit` (to be created)
Local: `atlas-audit/`