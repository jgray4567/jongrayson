# OpenMythos Project — Jerry Recipe Specialist

**Status:** Active — Prototype validated, training pipeline built
**Category:** AI
**Repo:** `/Users/jsg/.openclaw/workspace/OpenMythos/` (cloned from `kyegomez/OpenMythos`)
**GitHub:** https://github.com/kyegomez/OpenMythos
**PyPI:** `open-mythos` (v0.5.0)

## Overview

OpenMythos is an open-source theoretical reconstruction of Anthropic's Claude Mythos architecture — a **Recurrent-Depth Transformer (RDT)** with **Mixture-of-Experts (MoE)** and **Multi-Latent Attention (MLA)**. The core idea: one small set of layers is looped multiple times per forward pass. Easy tasks exit early (2-4 loops), hard tasks get more loops (8-16+). Same weights, variable depth, adaptive compute.

We're fine-tuning Mythos-3B as a **narrow recipe specialist** for the Jerry AI platform, serving Table & Tine and future projects.

## Architecture

```
Input token IDs
    ↓
[Prelude] — standard transformer layers (run once)
    ↓
[Recurrent Block] — one TransformerBlock looped T times
    ↑___________↓   h_{t+1} = A·h_t + B·e + Transformer(h_t, e)
    ↓
[Coda] — standard transformer layers (run once)
    ↓
[LM Head] → Output logits
```

- **LTI Stability:** Injection parameter A is constrained so spectral radius ρ(A) < 1 (guaranteed stable)
- **ACT Halting:** Adaptive Computation Time — model learns when to stop looping
- **MoE:** 64 experts, only 4 active per token (~5% of params active)
- **MLA:** Compressed KV latent cache, 10-20x smaller than standard attention

## Three Target Tasks

| Task | Loop Depth | Latency Target | Description |
|---|---|---|---|
| Recipe Extraction | 2-4 | <2s | URL/HTML → structured recipe JSON |
| Dietary Adaptation | 8-16 | <5s | Multi-constraint dietary swap reasoning |
| Content Moderation | 4-8 | <3s | Community recipe quality + safety review |

## Prototype Results (2026-06-12)

All tests passing on Apple Silicon (MPS):

- **Forward pass (MLA):** ✓ Working
- **LTI Stability:** ρ(A) = 0.368 (stable)
- **Adaptive loops (1/2/4/8):** ✓ Variable depth works
- **Token generation:** ✓ Working
- **mythos_1b config:** 1.06B params, ~0.5GB at 4-bit
- **Recipe endpoints:** All functional at 50-150ms per pass
- **Prototype script:** `.openclaw/tmp/jerry-mythos-prototype.py`

## Training Pipeline

### Scripts

| Script | Location | Purpose |
|---|---|---|
| Pretraining | `OpenMythos/training/3b_fine_web_edu.py` | Base model on FineWeb-Edu (30B tokens) |
| **Fine-tuning** | `OpenMythos/training/jerry_recipe_finetune.py` | Recipe specialist (5B tokens, ACT loss, loop-depth schedule) |
| Data prep | `OpenMythos/scripts/prepare_training_data.py` | Extract T&T swap DB + generate training examples |
| Prototype test | `.openclaw/tmp/jerry-mythos-prototype.py` | Architecture validation on MPS |

### Training Data

| Source | Examples | Type |
|---|---|---|
| Recipe1M+ (HuggingFace) | 1M+ | Extraction pretraining (streamed at train time) |
| T&T Dietary Swap Database | 57 | Adaptation pairs (extracted from Swift source) |
| Synthetic extraction | 6 | Extraction formatting examples |
| Synthetic moderation | 5 | Moderation decision examples |
| **Local total** | **68** | Supplement to Recipe1M+ |
| FineWeb-Edu (pretraining) | 1.3T tokens | General language pretraining |

### Training Data Output

`OpenMythos/data/jerry_training/`
- `dietary_swaps.jsonl` — 57 swap pairs from T&T Swift source
- `extraction_examples.jsonl` — synthetic extraction pairs
- `moderation_examples.jsonl` — synthetic moderation pairs
- `combined.jsonl` — all 68 examples combined

### Fine-Tuning Hyperparameters

| Param | Value | Notes |
|---|---|---|
| Target tokens | 5B | Domain fine-tune (vs 30B for pretraining) |
| Learning rate | 1e-4 | Lower than pretraining (3e-4) |
| Warmup | 500 steps | Shorter than pretraining (2000) |
| Batch size | 2 per GPU | Smaller for fine-tuning |
| Seq length | 2048 | Same as pretraining |
| ACT lambda | 0.01 | Compute penalty for adaptive depth |
| Loop schedule | [4,8,4,16,2,8,4,12] | Cycles through task-appropriate depths |
| Checkpoints | Every 500 steps | Saved to `checkpoints/jerry-recipe/` |

### Hardware Requirements

| Phase | Hardware | Cost | Time |
|---|---|---|---|
| Training | 1× A100 80GB (Lambda/RunPod) | ~$2/hr × 40-60hrs = **$80-120** | 40-60 hours |
| Inference (production) | Mac Studio M4 Max 128GB | ~$4,000-5,000 | Continuous |
| Inference (dev/test) | Mac Mini M4 Pro 24GB | Already owned | Continuous |
| Failover | Hetzner VPS + cloud API | ~$5-10/mo | Continuous |

### Mythos Model Sizes

| Variant | Parameters | 4-bit Size | Fits Mac Mini (24GB) | Fits Mac Studio (128GB) |
|---|---|---|---|---|
| mythos_1b | 1.06B | ~0.5GB | ✓ (easy) | ✓ |
| **mythos_3b** | **~3B** | **~6GB** | **✓** (18GB spare) | ✓ |
| mythos_10b | ~10B | ~20GB | Tight | ✓ (108GB spare) |

## Scaling Path

| Users | Model | Hardware | Monthly Cost |
|---|---|---|---|
| 0-1,000 | Mythos-3B (4-bit) | Mac Studio M4 Max | $10 (VPS failover) |
| 1,000-10,000 | Mythos-3B + caching | Mac Studio | $15 |
| 10,000-50,000 | Mythos-10B (4-bit) | Mac Studio | $20 |
| 50,000+ | Mythos-10B + cloud GPU | Mac Studio + Hetzner GPU | $100-300 |

## API Endpoints (Jerry Server)

### Recipe Extraction — `/v1/recipe/extract`
```
POST /v1/recipe/extract
Body: { "url": "https://...", "language": "en" }
Response: { "title", "ingredients", "instructions", "cookTime", "servings", "difficulty", "cuisine", "sourceUrl", "sourceName" }
Loops: 2-4 | Latency: <2s | Cache: 24h Redis
```

### Dietary Adaptation — `/v1/recipe/adapt`
```
POST /v1/recipe/adapt
Body: { "recipe": {...}, "profile": { "restrictions": ["Gluten-Free"], "allergens": ["Eggs"] } }
Response: { "adaptedRecipe", "swaps": [...], "warnings": [...], "confidence" }
Loops: 8-16 | Latency: <5s | Fallback: Static swap database
```

### Content Moderation — `/v1/recipe/moderate`
```
POST /v1/recipe/moderate
Body: { "recipe": {...}, "author": "user_123" }
Response: { "approved", "flags": [...], "quality": { "hasIngredients", "hasInstructions", "isOriginal" } }
Loops: 4-8 | Latency: <3s
```

### Health Check — `/v1/health`
```
GET /v1/health
Response: { "status": "ok", "model": "mythos-3b", "loops": 16, "uptime": 86400 }
```

## Networking (Tailscale + Cloudflare)

```
Internet → Cloudflare (DDoS + SSL) → Tailscale → Mac Studio (Jerry)
                                              ↓
                                        Hetzner VPS (failover proxy)
                                              ↓
                                    Cloud API (Together AI / OpenRouter)
```

## Roadmap

1. ~~Prototype validation on MPS~~ ✓ (2026-06-12)
2. ~~Training data preparation~~ ✓ (2026-06-12)
3. ~~Fine-tuning script~~ ✓ (2026-06-12)
4. **Pre-train base model** on FineWeb-Edu (needs A100, ~20-30 hrs)
5. **Fine-tune** on recipe data (needs A100, ~20-30 hrs)
6. **Quantize** to 4-bit (GPTQ/AWQ)
7. **Deploy** to Mac Studio for local inference
8. **Wire** into Jerry API (replace cloud endpoints)
9. **Calibrate** ACT halting thresholds per task
10. **Load test** with concurrent users

## Key Files

| File | Description |
|---|---|
| `OpenMythos/open_mythos/main.py` | Core model (OpenMythos class, MythosConfig, all sub-modules) |
| `OpenMythos/open_mythos/moda.py` | MoE FFN with routed + shared experts |
| `OpenMythos/open_mythos/tokenizer.py` | MythosTokenizer (gpt-oss-20b) |
| `OpenMythos/open_mythos/variants.py` | Pre-configured model scales (1B → 1T) |
| `OpenMythos/training/3b_fine_web_edu.py` | Pretraining script (FineWeb-Edu + FSDP) |
| `OpenMythos/training/jerry_recipe_finetune.py` | **Recipe fine-tuning script (our addition)** |
| `OpenMythos/scripts/prepare_training_data.py` | **Training data prep (our addition)** |
| `OpenMythos/docs/open_mythos.md` | Full API reference |
| `OpenMythos/docs/datasets.md` | Recommended training datasets |

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| No pre-trained weights exist | Pre-train from scratch on FineWeb-Edu ($80-120 on A100) |
| Training instability (looped models) | LTI injection guarantees ρ(A) < 1; grad clipping at 1.0 |
| MoE routing collapse | Load-balancing bias in router; monitor expert utilization |
| MPS backend gaps | Eigenvalue ops fallback to CPU; production on Mac Studio uses Metal |
| Quality below cloud APIs | Keep cloud failover; benchmark Mythos vs GLM/Qwen before switching |
| Mac Studio not acquired yet | Dev/test on Mac Mini M4 Pro (mythos_3b at 4-bit fits) |
| Single point of failure | Hetzner VPS proxy + cloud API fallback chain |

## Cost Comparison

| Approach | 200 users/day × 5 req each | Monthly Cost |
|---|---|---|
| Together AI cloud API | $0.002/request | **$600/mo** |
| OpenAI API | $0.03/request | **$9,000/mo** |
| **Mythos-3B on Mac Studio** | **$0/request** | **$10/mo** (VPS only) |

Jerry pays for its hardware in **7 months** at cloud API rates.