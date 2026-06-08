# Knowledge Base Log

> Auto-maintained changelog. Every ingestion, dream sequence, or wiki update gets logged here.

## 2026-06-08 — Initial Wiki Setup
- Created wiki structure (index, log, processed)
- Ingested YouTube video: "Build a Self-Evolving Claude Knowledge Base" (K2BpNt3UBOQ)
- Key takeaways applied: wiki/index structure, processed registry, dream sequence concept
- Cloned 11 Karpathy repos to `karpathy/`
- Created `memory/karpathy-repos.md` with repo map

## 2026-06-08 — Karpathy Autoresearch
- Cloned `autoresearch` repo
- Key concept: 5-minute experiment loop, agent modifies train.py, keeps/discards changes
- `program.md` serves as agent instructions (like our MEMORY.md pattern)
- Results logged to `results.tsv` (tab-separated, not committed)

## 2026-06-08 — Dashboard + Intel Scheduled Jobs Deployed
- Built JerryKnows Command Center dashboard (Inter font, 5 tabs: Overview, Projects, Memory Topics, Karpathy Labs, Scheduled Jobs)
- Deployed to https://www.jongrayson.com/coms/ via GitHub Actions → DreamHost SFTP
- Added Scheduled Jobs panel to https://www.jongrayson.com/intel/ left rail (terminal/cyan aesthetic)
- Both jobs shown: Memory Dream Sequence (Mon 9AM ET, brainwave/auto) and Karpathy Repo Check (Daily 8AM ET, glm-5.1:cloud)
- Created `dashboard/sync.sh` for one-command push-to-deploy
- Removed /command/ path (moved to /coms/)
- VPS dashboard service cleaned up (using DreamHost instead)

## 2026-06-08 — All Karpathy Repos Cloned & Assessed
- Cloned 26 repos total (~94MB) into `karpathy/` workspace
- Categorized by value: 12 high-value (nanoGPT, nanochat, llm.c, llama2.c, micrograd, minGPT, minbpe, autoresearch, nn-zero-to-hero, makemore, build-nanogpt, LLM101n)
- 10 useful tools (rendergit, gitstats, reader3, ulogme, calorie, cryptos, llm-council, arxiv-sanity-lite, hn-time-capsule, paper-notes)
- 9 educational/reference only
- Skipped 17 repos (dated/niche)
- Full assessment in `memory/karpathy-repos.md`

## 2026-06-08 — Second Brain Video Synthesis
- Video: Karpathy's LLM Wiki pattern — 5 building blocks
  1. **CLAUDE.md** (operating manual) → maps to our MEMORY.md
  2. **raw/** (dumping ground) → we use `memory/raw/`
  3. **wiki/** (organized knowledge) → we use `memory/wiki/`
  4. **outputs/** (generated artifacts) → we use workspace root
  5. **Dream sequence** (periodic audit) → OpenClaw cron job
- Action items:
  - Set up weekly dream sequence cron job to audit MEMORY.md + wiki for contradictions/stale claims
  - Use `memory/raw/` for unprocessed article dumps
  - Keep wiki index and processed registry for fast retrieval