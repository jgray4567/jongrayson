# AI-Powered CMS (GDP PageForge)

**Category:** Application
**Status:** In Development
**Main URL:** https://graysondp.com

## Overview

Productized CMS service built on a forked Strapi instance with an AI page generation module. Clients receive a custom Strapi instance pre-loaded with their design system and component library. The AI analyzes uploaded content (images, documents, spreadsheets, text) and composes page layouts using the client's own components — not templates, but editorial decisions constrained by their brand.

This is not a GDP self-serve feature. It's a **client deliverable** — each deployment is custom, with the client's design system baked in.

## Architecture

```
Client drops into Strapi admin:
  Images (JPG/PNG/WEBP)
  Documents (PDF/DOCX)
  Spreadsheets (XLSX/CSV)
  Raw text / brief
              ↓
┌─────────────────────────┐
│  Pass 1: Analyze         │
│  ─────────────────────── │
│  Vision model classifies │
│  each image:             │
│  • hero candidate?      │
│  • portrait?             │
│  • product shot?        │
│  • data viz source?     │
│  • background texture?  │
│                          │
│  LLM extracts from docs:│
│  • key claims & stats   │
│  • heading structure    │
│  • pull quotes          │
│  • narrative arc         │
│                          │
│  Parser handles data:    │
│  • chart-worthy cols?   │
│  • table data?          │
│  • stat callout values? │
└─────────────────────────┘
              ↓
┌─────────────────────────┐
│  Pass 2: Compose         │
│  ─────────────────────── │
│  Given:                  │
│  • Analyzed inventory    │
│  • Design system schema │
│  • Component library    │
│                          │
│  AI makes decisions:    │
│  • Which components     │
│  • What order           │
│  • What content in each │
│  • Why (traceable)      │
│                          │
│  Output: structured JSON │
│  matching component map │
└─────────────────────────┘
              ↓
  Draft page in Strapi (human reviews)
              ↓
  Approve → Publish → Live
```

## Design System Encoding

Each client deployment includes a `design-system.json` that defines:

- **CSS variables** (colors, spacing, typography, breakpoints)
- **Component schema** (hero, feature-grid, stat-bar, testimonial-carousel, contact-form, etc.)
- **Layout rules** (max sections, spacing constraints, mobile breakpoints)
- **Brand voice** (tone guidelines for generated copy)

The AI can only compose from approved components. No rogue HTML, no off-brand styling.

## Model Strategy

### Pass 1 — Analyze (extraction/classification)
- **Primary:** Brainwave (free, 195K context, text-only) — document + text extraction
- **Fallback:** GLM-5.2 cloud (1M context, $1.40/$4.40/M tokens) — if Brainwave fails or times out
- **Vision:** gemma4:12b (local) or cloud vision API — image classification
- **Spreadsheet parsing:** Server-side (no AI needed)
- **Requirement:** Mechanical accuracy, not design sense
- **Can run on:** Any capable model

### Pass 2 — Compose (editorial judgment)
- **Primary:** GLM-5.2 cloud (1M context, dual thinking High/Max, tool calling)
- **Fallback:** Claude Sonnet (via API) — if GLM-5.2 unavailable
- **End state:** Fine-tuned Mythos-3B running locally on Mac Studio
- **Requirement:** Understands visual hierarchy, editorial decisions, layout relationships
- **Every composition logged** → becomes training data for Mythos-3B fine-tuning

### Model Routing (updated 2026-06-22)
- **Brainwave** → first attempt for extraction + light composition (free)
- **GLM-5.2** → fallback if Brainwave fails, primary for composition + render passes
- **Mythos-3B** → future local inference (zero marginal cost at scale)
- This matches the existing sub-agent delegation rule in MEMORY.md

### Training Path for Mythos-3B

| Phase | Model | Cost | Notes |
|---|---|---|---|
| Launch (months 1-4) | Claude Sonnet API | ~$50-100/mo | Log every composition decision |
| Collect | — | — | Accumulate 200-500 logged compositions |
| Train | Mythos-3B on A100 | $80-120 one-time | Fine-tune on composition log |
| Deploy | Mythos-3B local | $0/mo | Mac Studio inference, zero marginal cost |

## Tech Stack

| Component | Technology | Notes |
|---|---|---|
| CMS | Strapi v5 (forked) | MIT license, fully customizable |
| Frontend | Next.js 16 | Per-client, renders component JSON |
| AI Plugin | strapi-plugin-ai-pages | Custom, adds "Generate" button |
| Content Type | ai_page_draft | Draft pages with structured JSON |
| Design System | design-system.json | Per-client, constrains AI output |
| Vision | gemma4:12b (local) or cloud API | Image classification |
| Composition | Brainwave → GLM-5.2 → Mythos-3B | Editorial layout decisions |
| Hosting | Per-client (Vercel/Netlify) | Or GDP-managed VPS |

## Service Tiers (Proposed)

| Tier | Includes | Price |
|---|---|---|
| **Setup** | Strapi instance + design system encoding + AI plugin | $15-25K |
| **Monthly** | Hosting + AI generation credits + support | $500-2K/mo |
| **Enterprise** | Custom components + multi-site + white-label | Custom |

## Key Differentiators

1. **Not a template engine** — AI makes editorial decisions, not slot fills
2. **Client-owned design system** — every output is on-brand
3. **Multi-modal input** — images, docs, data, text all processed
4. **Traceable decisions** — clients can see *why* the AI chose each layout
5. **Local inference path** — Mythos-3B → zero marginal cost at scale
6. **Strapi foundation** — clients get a real CMS, not a proprietary lock-in

## Related Projects

- **OpenMythos / Jerry Recipe Specialist** — same Mythos-3B model, different domain (recipes vs layout)
- **GDP App Studio** — pricing model and scope estimator inform CMS tier pricing
- **FAF Website** — first potential Strapi + Next.js deployment (already spec'd)

## Roadmap

1. ⬜ **Document design-system.json schema** — component library format
2. ⬜ **Build Strapi plugin prototype** — "Generate" button + API integration
3. ⬜ **Build Pass 1 (Analyze) pipeline** — image classification + doc extraction
4. ⬜ **Build Pass 2 (Compose) pipeline** — Claude API → structured JSON
5. ⬜ **Build ai_page_draft content type** — Strapi schema
6. ⬜ **Build Next.js component renderer** — reads JSON, renders components
7. ⬜ **Build design-system validator** — ensures AI output matches schema
8. ⬜ **First client deployment** — (FAF or new client)
9. ⬜ **Collect 200+ composition logs** — training data for Mythos
10. ⬜ **Fine-tune Mythos-3B** — replace Claude with local model
11. ⬜ **Package as productized service** — standardize setup process