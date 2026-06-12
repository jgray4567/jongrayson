
- **Giuseppe's Group Chat Rule:** In the Telegram group chat with Sal, my scope is strictly limited to **menu changes only**.

### Jon's Websites
- **Jon Grayson (jongrayson.com):** Personal/portfolio site. Intel globe + crime map, AI Playbook. GitHub: `jgray4567/jongrayson`. Deployed via SFTP to DreamHost (`iad1-shared-b8-08.dreamhost.com`, user `dh_9geaer`).
- **Grayson Design Partners (graysondp.com):** Design studio site. **LIVE** as of 2026-06-11 on NetworkSolutions. GitHub: `jgray4567/graysondp-site`. Deployed via SFTP (`05d87cd.netsolhost.com`, user `gdpdeploy`). Local workspace: `GraysonDP Dev/upload/`. Archive of old site: `GraysonDP Dev/archive/`. 6 must-fix issues from review (hidden clients, dead Approach link, missing OG, no canonical, empty alts, reveal-only) — **all 6 fixed in new upload**. GitHub Actions deploy workflow pending.
- **Giuseppe's (giuseppesva.com):** Restaurant site. Events page with dynamic Facebook scraper, menu, catering. GitHub: `jgray4567/giuseppesva-site`. Deployed via GitHub Pages.
- **One Hot Mess (onehotmess.band):** Band site. GitHub: `jgray4567/onehotmess`. Deployed via GitHub Pages.
- **Cracked Sky (crackedsky.band):** Band site. Events page with JSON-driven calendar. GitHub: `jgray4567/crackedsky`. Deployed via GitHub Pages.

### Model Lineup & Routing (Quarterback System)
- **Primary (daily driver):** `ollama/glm-5.1:cloud` — general-purpose, all tasks
- **Heavy coding:** `ollama/qwen3-coder:480b-cloud` — multi-file coding, debugging, refactoring (Ollama Cloud, 480B MoE, 262K context)
- **Local agentic/vision:** `gemma4:12b` (9.6GB, QAT, native function calling + vision, 256K context, on Apple Silicon)
- **Paused (on hold per Jon):** brainwave/auto, google/gemini-3.1-pro-preview, openai/gpt-5.4, anthropic/claude-sonnet-4-6, google/gemini-3.5-flash
- **Quarterback rule:** Agent routes tasks to the best model. Ollama-only by default; paused models reactivated only on explicit Jon request.
- **Qwen3 Coder 24h Assessment:** Running 2026-06-08 → 2026-06-09. Tracking at `memory/qwen3-coder-assessment.md`. Cron `bab6e082-964e-4d2e-814b-ad242352fc3e` will deliver final verdict.

### OpenMythos — Jerry Recipe Specialist
- **Project file:** `memory/projects/openmythos-jerry.md`
- **Repo:** `~/workspace/OpenMythos/` (cloned from `kyegomez/OpenMythos`, PyPI v0.5.0)
- **Architecture:** Recurrent-Depth Transformer (RDT) + MoE (64 experts, 4 active) + MLA attention + LTI-stable injection
- **Target:** Fine-tune Mythos-3B as narrow recipe expert (extraction, dietary adaptation, moderation)
- **Prototype:** Validated 2026-06-12 on Apple Silicon MPS. All tests passing. ρ(A) = 0.368 (stable).
- **Training:** `OpenMythos/training/jerry_recipe_finetune.py` — fine-tune on 5B tokens (Recipe1M+ + T&T swaps + ACT loss)
- **Data prep:** `OpenMythos/scripts/prepare_training_data.py` — 57 swaps from T&T Swift + synthetic examples
- **Hardware:** Train on 1× A100 ($80-120), infer on Mac Studio M4 Max 128GB (~$4-5K)
- **Cost:** Zero marginal cost inference vs $600/mo cloud API at scale. Pays for hardware in 7 months.
- **Status:** Prototype ✓, Training pipeline ✓, Data prep ✓. Next: pre-train base model on A100, fine-tune, quantize, deploy.

### Jerry AI (Local AI Project)
- **Drive:** WD_BLACK SN7100 1TB NVMe → `/Volumes/Frankenstein/MLX-Models/`
- **Python env:** `~/mlx-env/` (mlx 0.31.2, mlx-lm 0.31.3, mlx-vlm 0.4.4, vmlx 1.3.86)
- **Ollama:** v0.24.0 (MLX backend since 0.19, 2x faster than llama.cpp)
- **Models on disk:** gemma4:12b (9.6GB), gemma:2b (1.7GB), glm-5.1:cloud (cloud)
- **Models on Frankenstein:** DeepSeek V4 Flash 4-bit (266GB), Qwen3-235B (123GB), Qwen3-Coder-30B (16GB), Flux Schnell/Dev 4-bit (18GB)
- **MLX Research:** `memory/apple-mlx-research.md` — full breakdown of MLX, Foundation Models, fine-tuning, Rapid-MLX
- **Project file:** `memory/projects/jerry-ai.md`
- **Fine-tuning plan:** Qwen3-8B 4-bit LoRA on recipe data (viable on 24GB RAM). Min 200-500 examples for behavior change.
- **Rapid-MLX:** Drop-in Ollama replacement, 2-4.2x faster. Consider for JerryKnows API local serving.

### Second Brain (Karpathy LLM Wiki Pattern)
*   **Architecture:** 6 building blocks — `MEMORY.md` (operating manual), `SCRATCHPAD.md` (cross-session persistent TODOs), `memory/raw/` (dumping ground), `memory/wiki/` (organized knowledge with index/log/processed), `outputs/` (generated artifacts like PDFs, slides, code exports), and a weekly **dream sequence** cron job that audits for contradictions, stale claims, duplicates, and orphans.
*   **SCRATCHPAD.md:** Persistent cross-session checklist. Check at session start. Open items stay across sessions. Mark done with `[x]` + date. Dream sequence audits for items open 7+ days.
*   **Dream Sequence:** Runs every Monday at 9am ET (cron job `06fbb20b-97be-4785-9b06-316e24ddfbe3`). Audits all memory files, promotes session insights, cleans orphans, and reports findings.
*   **Distil Pattern:** Before writing to MEMORY.md, ask: "Is this a durable fact that belongs in every session, or a session note?" If 3+ daily mentions of same pattern → promote to MEMORY.md. Dream sequence also scans daily logs for patterns to promote.
*   **Error Compaction (Factor 9):** When something fails 3+ times, compact into a one-liner lesson. Store in `memory/wiki/lessons.md` instead of keeping full stack traces. Dream sequence scans for repeated failures and compacts them.
*   **Wiki Index:** `memory/wiki/index.md` — table of contents mapping all topics to their files.
*   **Wiki Log:** `memory/wiki/log.md` — changelog of every ingestion, dream run, and update.
*   **Processed Registry:** `memory/wiki/processed.md` — tracks which raw files have been ingested to prevent re-processing.
*   **Raw Folder:** `memory/raw/` — drop any article, transcript, or link dump here. The dream sequence will organize it into wiki.
*   **Auto-Ingest:** When I say "save this", the agent saves the source to `memory/raw/`, updates `wiki/processed.md`, updates `wiki/index.md`, and date-stamps `wiki/log.md`.
*   **Deep Research:** When I say "research [topic]", the agent does deep research, dumps findings into `memory/raw/`, then auto-ingests into wiki.
*   **Query Pattern:** When asking about knowledge base content, search `wiki/index.md` first, then drill into relevant files for detailed answers.
*   **Outputs:** `outputs/` folder stores generated artifacts (PDFs, slide decks, code exports, presentations). Clean up stale outputs periodically.

### Karpathy Repos (Local)
*   **Location:** `karpathy/` in workspace (11 repos cloned 2026-06-08)
*   **Index:** `memory/karpathy-repos.md` — descriptions and links for all cloned repos
*   **Key repos:** nanoGPT, minGPT, llm.c, llama2.c, micrograd, makemore, minbpe, nanochat, autoresearch, build-nanogpt, nn-zero-to-hero, LLM101n
*   **Also cloned:** arxiv-sanity-lite, calorie, cryptos, gitstats, hn-time-capsule, jobs, llm-council, paper-notes, reader3, rendergit, researchlei, researchpooler, ulogme, char-rnn
*   **Total:** 30 repos (~100MB) — full assessment at `memory/karpathy-repos.md`
*   **Autoresearch forks:** `karpathy/autoresearch` (original, NVIDIA) + `karpathy/autoresearch-macos` (miolini fork, Apple Silicon/MPS, runs on our Mac Mini M4 Pro)
*   **Daily Repo Check:** Cron scans GitHub for new Karpathy repos daily at 8AM ET, clones useful ones, announces via Telegram

### Storage & Infrastructure
- **Mac Mini M4 Pro:** 24GB unified memory (not 16GB as previously noted). Apple M4 Pro chip.
- **Internal SSD:** 460GB total, ~290GB free (63%). Ollama models ~18GB, workspace ~10GB, system ~12GB.
- **External Frankenstein Drive:** 931GB total, ~507GB free (55%). MLX models 424GB (DeepSeek V4 266GB, Qwen3-235B 123GB, Qwen3-Coder-30B 16GB, Flux 18GB).
- **Storage monitoring:** Include disk/RAM check in weekly Dream Sequence audit. Alert if internal SSD drops below 50GB free or Frankenstein drops below 200GB free.

### Reusable Patterns & Systems
- **Fiscal Alliance Foundation (FAF):** Full website build. Architecture PDF defines Strapi CMS model, content taxonomy, Mailchimp integration, state chapter template system. Local PoC running (Strapi v5 + Next.js 16). Awaiting pixel-perfect HTML/CSS from Jon for conversion to templates. **Build spec:** `memory/projects/faf-website.md`. Mobile-first (65-80% mobile audience). Jon delivers designed HTML/CSS, I convert to Next.js components wired to Strapi. - **Papal Foundation Annual Report:** Parsed 2025 grant data from PDF, compiled stats for infographic. Data saved in `Papal Foundation/2025_stats_summary.md`. Awaiting direction from Jon/designer Joy on chart format.
- **DreamHost deploy pipeline:** SFTP via paramiko works. GitHub Actions auto-deploys crime data daily. Credentials stored as GitHub Secrets.
- **NetworkSolutions deploy pipeline (GDP):** SFTP via lftp to `05d87cd.netsolhost.com`, user `gdpdeploy`. Files must be chmod 644/755 after upload (NetworkSolutions SFTP creates files with 600 perms). No SSH shell access. lftp `mirror --reverse --delete` for full deploys. `.git` directory on server: couldn't fully remove (nested), but harmless (not served).
- **VPS (Hetzner):** IPv6-only at `2a01:4ff:f4:a2ca::1`. SSH: `vps_kbot` (user `jon`). Nginx + SSL via Cloudflare. No sudo. Services: jerryknows-ai (8791), bogleai (8789), jerryknows-app (8787), dashboard (8793). All run via PM2 (v7.0.1). OpenClaw gateway v2026.6.5. Full audit: `memory/projects/vps-audit-2026-06-11.md` — **6 critical fixes need sudo:** firewall, root SSH, app ports exposed, cert permissions, swap, PM2 startup.
- **Table & Tine website:** `jgray4567/tableandtine-site` on GitHub Pages. CNAME: tableandtine.com. Deploy: push to main, auto-deploys. Local source: `.openclaw/tmp/tableandtine-site/`. Deploy script: `deploy.sh`.
- **SKB Customs:** `memory/projects/skb-customs.md` — Client spec. Custom pontoon boat restoration shop in Mineral, VA. Currently Webflow site, wants ecommerce. Reseller for Chicago Pontoon Parts (300+ products, Magento 1, EOL). Proposed: Strapi + Next.js + Stripe on AX52 hosting platform. Awaiting confirmation on partnership status.
- **Dashboard (Coms):** Jon Grayson JK Command Center live at https://www.jongrayson.com/coms/ — deployed via GitHub Actions to DreamHost. Source in `dashboard/` workspace. Fonts: Inter (all). Tabs: Overview, Projects, Memory Topics, Karpathy Labs, Scheduled Jobs. Sync: `dashboard/sync.sh` pushes to GitHub, auto-deploys via SFTP.
- **Intel Scheduled Jobs Panel:** Added to https://www.jongrayson.com/intel/ left rail — shows Memory Dream Sequence (Mon 9AM ET, brainwave/auto) and Karpathy Repo Check (Daily 8AM ET, glm-5.1:cloud → brainwave → sonnet). Styled in terminal/cyan aesthetic matching Intel UI.
- **Karpathy Daily Repo Check:** Cron job `798107f0-1909-4b1e-9c1b-aef6c9e4adc1` — runs daily at 8AM ET on ollama/glm-5.1:cloud (no fallbacks, Ollama-only). Scans for new Karpathy repos, clones useful ones, updates `memory/karpathy-repos.md`, announces findings via Telegram.
- **Memory Dream Sequence:** Cron job `06fbb20b-97be-4785-9b06-316e24ddfbe3` — runs weekly Mon 9AM ET on ollama/glm-5.1:cloud (no fallbacks, Ollama-only). Audits MEMORY.md + wiki for contradictions, stale claims, duplicates, orphans; promotes session insights; reports findings.
- **Deploy Pipeline:** Push to `jgray4567/jongrayson` main → GitHub Actions auto-deploys via SFTP/lftp to DreamHost. Separate workflow `deploy-dashboard.yml` for manual dashboard-only deploys. No sudo needed; DreamHost handles SSL.

### Table & Tine (iOS App)
- **Type:** SwiftUI + SwiftData + CloudKit recipe app
- **Project root:** `/Users/jsg/.openclaw/workspace/TableAndTine/TableAndTine/`
- **Source:** `TableAndTine/TableAndTine/TableAndTine/`
- **Xcode project:** `TableAndTine.xcodeproj`
- **Key models:** Recipe (has `isPublished`), ImportDraft, Cookbook — all registered in Schema
- **CloudKit:** `.automatic` database, handles schema migration
- **Premium:** StoreKit 2, products `com.tableandtine.premium.monthly` ($3.99) / `.annual` ($31.99), 7-day trial, free limit 15 recipes
- **AppStorage keys:** `displayName`, `userBio` (not `profileBio`), `profilePhotoData` (typed as `Data`, default `Data()`), `hasCompletedOnboarding`, `hasAcceptedTerms`, `defaultView`, `measurementSystem`, `paperSize`, `cookingStylesData`, `dietaryNotesData`, `notificationsEnabled`
- **Recipe extraction API:** `https://api.tableandtine.com` (override key: `tableandtine_api_base_url`)
- **8 bugs fixed (2026-06-08):** Community Table publishing, search, featured section, save button, profile photo on HomeView & RecipeDetailView, AppStorage key mismatch (`profileBio`→`userBio`), AppStorage type mismatch (`Data?`→`Data`)
- **6 additional bugs fixed (2026-06-09):** ImportViewModel draft field transfer, EditRecipeView premium gate, ImportReviewView premium gate, author snapshot at publish time, RecipeCardView isFavorited init, all import paths premium-verified
- **Pre-launch code fixes completed (2026-06-09):** All 16 dietary swap databases (vegetarian, vegan, GF, diabetic, keto/lowCarb, DF, paleo, nut-free, low-sodium, egg-free, soy-free, corn-free, low-FODMAP, halal, kosher + allergen cross-references). Onboarding expanded to all 15 dietary options. Copyright notices on all 4 import views. BeverageView created with category filter + HomeView nav card. DietarySwapView upgraded: toggle individual swaps, preview adapted ingredients, save adapted version as new recipe, AI disclaimer on first use.
- **App config ready (2026-06-09):** StoreKit config (Configuration.storekit) with monthly $3.99 + annual $31.99 + 7-day trial. Privacy manifest (PrivacyInfo.xcprivacy). ITSAppUsesNonExemptEncryption=false. Version 1.0.0/1. Entitlements: iCloud, StoreKit, CloudKit. ATS locked down to specific domains.
- **Legal pages live (2026-06-09):** 5 HTML pages deployed to GitHub Pages repo `jgray4567/tableandtine-site`. Landing page at index.html with links to all legal pages. CNAME set to tableandtine.com. HTTPS cert pending DNS verification.
- **DNS needed:** Cloudflare DNS for tableandtine.com — add CNAME `@` → `jgray4567.github.io` (DNS only/grey cloud) and CNAME `www` → `jgray4567.github.io` (DNS only/grey cloud).
- **Deploy script:** `.openclaw/tmp/tableandtine-site/deploy.sh` — git push triggers GitHub Pages auto-deploy.
- **4 cosmetic deferred:** search state persistence, tappable source URL, notifications toggle, terms version tracking
- **5 lower-priority issues documented (not fixed yet):** No terms version tracking, no Community Guidelines in terms, no age verification gate, no offline URL import queuing, photo import premium-gated but URL/paste aren't
- **Full codebase re-inspection completed** — all 25+ Swift files reviewed
- **Testing plan:** `TableAndTine/TESTING_PLAN.md` (80+ test cases across 16 sections)
- **Apple Developer Program:** Jon is enrolled (2026-06-09)
- **On-Device AI (FoundationModelsService):** `Services/FoundationModelsService.swift` — result types + SmartAIService with cloud API fallback. `Services/FoundationModelsService+iOS26.swift` — full Generable/LanguageModelSession implementation, excluded from build until iOS 26 SDK available. SmartAIService.hasOnDeviceAI currently hardcoded false.
- **SmartAIService:** Dispatches between on-device (iOS 26+) and cloud API (older devices). Zero cost, offline, privacy-first. Currently falls back to cloud API only.
- **Shopping List Feature (2026-06-10):** `Services/ShoppingListService.swift` — generates checklist text with `☐` prefix, 4 export options (Copy, Notes, Share Sheet, Reminders). `IngredientRow` — tappable checkbox rows with strikethrough + haptic. `AddToShoppingListButton` — menu above ingredient list in RecipeDetailView. Includes recipe metadata (servings, prep/cook time).
- **Code Quality (2026-06-10):** Full audit completed. 8 warnings eliminated → zero errors, zero warnings build. Fixed: RecipeImporter JSON cast, RecipeParser unused vars, RecipePrintView/CookbookExportView @MainActor, RecipeDetailView optional interpolation, AppHaptic @MainActor, AppError unused binding, PremiumView async warning.
- **MLX fine-tuning roadmap:** Train Qwen3-8B on T&T community recipes. See `memory/apple-mlx-research.md`.
- **Next step:** Draft App Store listing copy, wire SmartAIService into import/dietary swap call sites, build MLX training dataset template, App Store Connect setup (requires Jon's login)

### JK Web Team Hosting Platform
- **Project file:** `memory/projects/jk-hosting-platform.md` — full architecture, cost breakdown, migration plan
- **Goal:** Single Hetzner AX52 dedicated server (~$73/mo) hosting 50 sites, Strapi CMS, AI products, OpenClaw agent
- **Architecture:** Caddy reverse proxy → Docker containers (Strapi, Next.js, AI services) → Cloudflare DNS/proxy
- **Strapi multi-tenant:** Shared instance default (scoped permissions per client), isolated instances only on request
- **AI manages:** Infrastructure, monitoring, onboarding, backups, security, automation
- **Jon manages:** Client relationships, pricing, content decisions
- **Status:** Planning phase — awaiting Jon's go-ahead to provision server and begin migration

### JerryKnows AI — Recipe Mode
- **Backend (live on VPS):** `/api/recipe/extract`, `/api/recipe/adapt`, `/api/recipe/nutrition` — port 8791
- **Frontend:** 🍳 button in topbar, slide-out recipe panel with Extract/Adapt/Nutrition tabs
- **Frontend deploy:** On hold pending Jon's go-ahead

### JK Web Team Arsenal & Capabilities
*   **Asset Plan:** A strategic guide on how to deploy our tools is saved at `clients/jk_web_team_asset_plan.md`.
*   **Code Mapping:** Use `codesight` to map new/legacy codebases, and `understand-anything` for visual node graphs.
*   **Security:** Use `mukul975/Anthropic-Cybersecurity-Skills` for deep, MITRE-mapped security audits.
*   **Writing/Prose:** Always use `hardikpandya/stop-slop` when drafting client copy to remove AI tells.
*   **Presentations & Wiki:** Use `presentation-ai` (Gamma alternative) for pitch decks and `AppFlowy` for local, secure client wikis.
*   **Media/Design:** Use `Canva-Creator-ToolKit` for rapid asset generation, `NVIDIA-GenAI-Creator-Toolkit` for heavy generative media, and the local YouTube downloaders for asset scraping.
*   **Business Ops:** The `knowledge-work-plugins` repository contains 11 official Anthropic templates to spawn specialized sub-agents (Sales, Analyst, etc.).

### Karpathy Loop (Autoresearch Pattern)
*   **Core pattern:** Change → Measure → Keep/Discard → Repeat. Point an autonomous agent at anything editable, give it a measurable score, and let it run experiments unsupervised.
*   **Three prerequisites:** (1) Something editable (code, config, prompt, SKILL.md), (2) A way to measure improvement (score, benchmark, pass/fail), (3) A time-boxed test (run it, get result, decide keep/discard).
*   **Key insight from Karpathy:** He gave an agent his already-well-tuned training code, said "make the loss go down, don't ask me." 700 experiments, 20 real improvements, 11% efficiency gain on a project he'd hand-tuned for years. Every improvement generalized to larger models.
*   **Eval rubric is the critical piece:** Convert fuzzy 1-5 quality scores into binary yes/no checks. "Does the hook include a specific number?" Yes/no. Two agents scoring the same output should agree. This is what makes unsupervised optimization work.
*   **Three-phase meta-skill:** (1) Setup — human approves test cases, rubric, binary evals; (2) Autonomous loop — mutate one thing, score with binary evals, keep/discard, repeat until stop criteria; (3) Debrief — re-score with original 1-5 rubric, compare before/after.
*   **Sweet spot:** 60-80% quality. Below that, rewrite first. Above 90%, diminishing returns. The loop finds specific, repeatable failure patterns.
*   **Application to our skills:** We can point an autoresearch loop at any OpenClaw SKILL.md — Intel shell.js logic, event scrapers, T&T recipe parser — with binary evals and let it iterate on quality autonomously.
*   **Source:** aimaker.substack.com — "How I Built a Skill That Improves All Skills (Karpathy Autoresearch Loop)"
*   **Skill proposal:** `karpathy-loop-20260611-88468e211c` — pending in Skill Workshop, includes full three-phase procedure, mutation strategies, eval rubric templates, and file templates.

### TRIGGER RULE: Karpathy Loop Activation
*   **Condition:** When a skill, prompt, or workflow is functional (60-80% quality) but could be better, and the user says "optimize," "improve," "tune," "iterate on," or "run the loop on" something.
*   **Condition:** After building or refactoring a skill, before shipping.
*   **Action:** Invoke the `karpathy-loop` skill. Follow its three-phase procedure: (1) Setup — create test cases, build 1-5 rubric, run baseline, convert to binary evals, get human approval; (2) Autonomous loop — mutate one thing per iteration, score with binary evals, keep/discard, log everything; (3) Debrief — re-score with 1-5 rubric, compare before/after, report results.
*   **Do NOT invoke when:** The target is broken (< 60% quality — rewrite first), already excellent (> 90% — diminishing returns), or when you can't define what "good" looks like.

### Extended Tooling (SaaS Replacements)
*   **Ad Audits:** `claude-ads` (6 parallel sub-agents for Meta/Google ad account audits).
*   **Video Generation:** `hyperframes` (agent-driven HTML to MP4 programmatic rendering).
*   **Stealth Scraping:** `camofox-browser` (OpenClaw plugin installed; C++ anti-detection, bypasses Cloudflare/bot checks; tools: camofox_create_tab, camofox_snapshot, camofox_click, camofox_type, camofox_navigate, camofox_screenshot). Also cloned: Invisible Playwright + Stealth Browser MCP for reference.
*   **Facebook Marketplace CLI:** `facebook-marketplace-pp-cli v2026.6.1` (search listings, watch items, draft seller listings, reply to buyers, manage inbox). Auth: `facebook-marketplace-pp-cli auth login --chrome` to capture Chrome session.
*   **Meta Ads CLI:** `meta-ads-pp-cli v2026.6.1` (snapshot brand ads on Facebook/Google/LinkedIn, track changes over time). Same auth method.
*   **12-Factor Agents:** Cloned to `github-repos/12-factor-agents/`. Key takeaways adapted: SCRATCHPAD.md (cross-session TODOs), distil pattern (auto-curate MEMORY.md), error compaction (Factor 9). Full notes: `memory/wiki/12-factor-agents.md`.
*   **Data/Finance Swarms:** `AutoHedge`, `Vibe-Trading`, and `FinceptTerminal` for multi-agent autonomous scraping, data analysis, and quantitative logic.
*   **Comms & UI:** `LibreChat` (self-hosted UI for all API models) and `agentic-inbox` (secure Cloudflare-based AI email client).

### Master Development Framework & Project Initialization
*   **MANDATORY FOR ALL DEVELOPMENT:** Whenever starting a new development project (app or website), always apply the **JK Web Team Master Development Framework** (and invoke the `jk-master-framework` skill).
*   **Initialization:** Run `scripts/jk-init.sh <ProjectName>` to scaffold new repositories. This enforces the modular structure (`/src`, `/tests`, `/docs`), creates handoff stubs (`README.md`, `SETUP.md`, `ARCHITECTURE.md`), sets up a local Git anti-slop pre-commit hook, and injects `.cursorrules` and `CLAUDE.md`.
*   **Core Rules:**
    1. **No Lazy Coding:** Provide complete, executable code blocks. No placeholders like `// ... rest of code`.
    2. **Stop-Slop:** Use dry, technical, and concise prose. Zero AI buzzwords.
    3. **Security:** Zero-trust coding via `secureclaw` (OWASP Top 10, no hardcoded secrets, input validation).
    4. **Architecture:** Strict modularity, separation of concerns. Use `codesight` for visual maps on large refactors.
    5. **Frontend Polish:** Distinct, production-grade UI design via `anthropics-frontend-design` (avoid generic templates).
*   **Workflows:** Use the `JK-Assembly-Line` taskflow (`templates/jk-taskflow-assembly.json`) for complex multi-agent builds (Architect -> Coder -> Auditor). Apply `templates/jk-framework-check.yml` for CI/CD enforcement.

### TRIGGER RULE: The Pre-Flight Check
*   **Condition:** Whenever the user asks to start coding, build a new feature, or initialize a project.
*   **Action:** Before outputting any code, you MUST output a brief "Pre-Flight Checklist" confirming:
    1. The `jk-init.sh` structure is being used (if new).
    2. The SecureClaw constraints are active.
    3. The Stop-Slop protocol is engaged.
    Only after explicitly confirming this rule may you begin generating the code.

### Mobile App Development (iOS/Android)
*   **MANDATORY FOR MOBILE:** Whenever building a mobile app, apply the `MOBILE_FRAMEWORK.md` rules.
*   **Initialization:** Run `scripts/jk-init-mobile.sh <ProjectName>` instead of the standard init script. This generates a strict Expo (React Native) project with EAS (Expo Application Services) deployment configurations.
*   **Mobile-Specific Rules:**
    1. **No HTML/DOM Elements:** Use `<View>`, `<Text>`, `<Image>`. Never `<div>` or `<span>`.
    2. **App Store Compliance:** Any hardware access (Camera, GPS, Mic) MUST be declared in `app.json` with user-facing justification strings, or Apple/Google will reject the app.
    3. **Safe Areas:** Always wrap views in `SafeAreaView` or `react-native-safe-area-context`.
    4. **CI/CD:** Use `eas.json` for automated builds to TestFlight/Play Console.
