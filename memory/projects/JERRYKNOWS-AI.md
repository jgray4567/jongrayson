# JerryKnows AI

**Category:** AI

## Overview
Standalone ChatGPT-style app for `https://jerryknows.ai` / `https://www.jerryknows.ai`, separate from JerryKnows Web Team and BogleAI.

## Key decisions
- This work belongs in `/Users/jsg/.openclaw/workspace/jerryknows-ai`.
- Keep `auto` as the default model and prefer free models first where possible.
- Legal/contracts expansion stays inside the existing JK app, not as a separate product.
- JerryKnows should use a hybrid infrastructure shape: **VPS as the public app edge** and a future **Mac Studio Ultra AI box as the private local inference engine**.
- Recommended Mac Studio target discussed: **Ultra M3, 256 GB unified memory, 60-core GPU, 2 TB SSD**. This is considered strong enough to serve as the serious local AI machine for JK, though 4 TB would be even better for model storage.

## Model routing
- general chat -> `meta-llama/llama-3.3-70b-instruct:free`
- search/current-events/document work -> `google/gemini-2.5-flash`
- legal/contracts and code/technical reasoning -> `anthropic/claude-sonnet-4.6`
- fallbacks include Gemini Pro / Flash and Llama free

## Implemented
- multi-model chat UI with server-side stored history
- OpenRouter live in `.env`
- model-used metadata wired end-to-end
- legal mode and legal tools built into the app
- true redline tab added
- policy-pack framework for Sara contract workflows
- general Google Sheets / Excel capability started as a separate, app-wide feature
- legal knowledge-base foundation added with source registry, ingestion script, and Research tab
- Open WebUI sidecar has been stood up on the VPS as `jk-openwebui`, currently running locally on `127.0.0.1:8792` pending final nginx/domain hookup
- a local JerryKnows utility-model path has been started around Ollama/Gemma (`gemma3:4b`) with a real `/api/internal/classify` endpoint and a local model option exposed in the JK model list

## Important distinctions
- Google Sheets / Excel support is for all JK users.
- Sara policy packs are a separate contract-review workflow and should not be conflated with general spreadsheet support.

## Future product vision
- **JerryKnows Contracts**: A specialized contract intelligence product (not just a model splice). The architecture plan focuses on a specialized open-source base model, fine-tuning for drafting/negotiation tone, deep legal RAG (clause library + policy packs), and a multi-agent "drafter/critic" workflow to ensure product-level quality. The plan is documented and shelved for later execution.

- `jerryknows-ai/src/server.js`
- `jerryknows-ai/src/llm.js`
- `jerryknows-ai/src/models.js`
- `jerryknows-ai/app/index.html`
- `jerryknows-ai/config/sara-policy-pack.template.json`
- `jerryknows-ai/config/legal-kb-sources.json`
- `jerryknows-ai/docs/OPEN-WEBUI-INTEGRATION.md`
- `jerryknows-ai/docs/LOCAL-GEMMA-PLAN.md`
- `jk-mac-studio-architecture.md`
