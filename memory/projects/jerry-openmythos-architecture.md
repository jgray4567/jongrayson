# OpenMythos — Adaptive Inference Architecture

**Category:** AI
**Status:** Active
**Applies to:** Table & Tine, JerryKnows AI, InspectAI, any project needing efficient local inference

## Overview

OpenMythos is a **general-purpose Adaptive Inference architecture** using Recurrent-Depth Transformers (RDT) with Mixture-of-Experts (MoE). Originally designed for Table & Tine's recipe extraction, it's now the standard inference pattern for any project that needs efficient, variable-depth AI on local hardware.

**The core idea:** One model, variable depth, adaptive compute, zero marginal cost. Easy tasks exit early. Hard tasks get more loops. No need to run multiple models.

### Cross-Project Use Cases

| Project | Use Case | Loop Depth | Latency Target |
|---|---|---|---|
| **Table & Tine** | Recipe URL extraction | 2-4 | <2s |
| **Table & Tine** | Complex dietary adaptation | 8-16 | <5s |
| **Table & Tine** | Content moderation | 4-8 | <3s |
| **JerryKnows AI** | Chat/reasoning (general) | 4-8 | <3s |
| **InspectAI** | Property analysis | 2-4 | <2s |
| **BogleAI** | Market data extraction | 2-4 | <2s |
| **Any project** | Classification/routing | 1-2 | <500ms |

---

## Architecture: RDT + MoE for Production Inference

### The Core Insight

Instead of running multiple models (router + extractor + dietary reasoner), Jerry runs ONE model with variable loop depth:

| Request Type | Loops | Latency Target | Compute |
|---|---|---|---|
| Recipe URL extraction | 2-4 | <2s | Minimal |
| Simple dietary swap lookup | 1-2 | <500ms | Trivial |
| Complex dietary adaptation (Celiac + Diabetic + Egg-Free) | 8-16 | <5s | Heavy |
| Content moderation (community recipe review) | 4-8 | <3s | Moderate |
| Recipe reformatting/normalization | 2-4 | <1s | Light |

Easy tasks exit early via Adaptive Computation Time (ACT). Hard tasks get more loops. One model, infinite flexibility.

### Model Configuration for M4 Max 128GB

```
Jerry Server (OpenMythos-based)
├── Model: Mythos-3B (custom fine-tuned)
│   ├── dim: 3072
│   ├── n_experts: 64 (only 4 active per token)
│   ├── expert_dim: 4096
│   ├── max_loop_iters: 16
│   ├── attn_type: MLA (compressed KV cache)
│   └── Parameters: ~3B total, ~200M active per token
│
├── Router: SmolLM3 135M (always loaded, <1ms)
│   └── Classifies request type, sets loop count target
│
├── MLX Runtime (Apple Silicon optimized)
│   ├── Model loaded once, shared across requests
│   ├── KV cache: MLA compressed (10-20x smaller than standard)
│   └── Batched inference for concurrent requests
│
├── Memory Budget (128GB M4 Max)
│   ├── Model weights: ~6GB (4-bit quantized)
│   ├── KV cache pool: ~8GB (MLA compressed, serves 200+ concurrent)
│   ├── OS + system: ~8GB
│   ├── Available for other services: ~106GB
│   └── Can run Mythos-10B if needed (still fits in 128GB)
│
└── API Layer (Swift/NIO or Node.js)
    ├── REST endpoints: /v1/recipe/extract, /v1/recipe/adapt, /v1/recipe/moderate
    ├── Rate limiting: 100 req/min free, 1000 req/min premium
    ├── Caching: Redis for repeated URL extractions
    └── Queue: Priority queue (premium users skip ahead)
```

### Why 3B, Not 10B or 70B

| Size | RAM (4-bit) | Active Params | Concurrent Users | Latency |
|---|---|---|---|---|
| 770M | ~1.5GB | ~50M | 500+ | <500ms |
| **3B** | **~6GB** | **~200M** | **200+** | **<2s** |
| 10B | ~20GB | ~500M | 50+ | <5s |
| 70B | ~40GB | ~3.5B | 10-20 | <10s |

**3B is the sweet spot** for M4 Max:
- Only 200M active parameters per token (MoE means 95% of weights are dormant)
- MLA KV cache is 10-20x smaller → way more concurrent users
- 128GB RAM leaves room for everything else (database, cache, monitoring)
- Can always upgrade to 10B later if traffic demands it

---

## API Endpoints

### Recipe Extraction (`/v1/recipe/extract`)
```
POST /v1/recipe/extract
Body: { "url": "https://cooking.nytimes.com/recipes/...", "language": "en" }
Response: {
  "title": "Pasta Carbonara",
  "ingredients": [...],
  "instructions": [...],
  "cookTime": "30 min",
  "servings": 4,
  "difficulty": "Medium",
  "cuisine": "Italian",
  "sourceUrl": "...",
  "sourceName": "NYTimes Cooking"
}
```
- **Loops:** 2-4 (simple extraction)
- **Latency:** <2s
- **Cache:** 24h Redis cache for repeated URLs

### Dietary Adaptation (`/v1/recipe/adapt`)
```
POST /v1/recipe/adapt
Body: {
  "recipe": { ... },
  "profile": {
    "restrictions": ["Gluten-Free", "Diabetic"],
    "allergens": ["Eggs"]
  }
}
Response: {
  "adaptedRecipe": { ... },
  "swaps": [
    { "original": "all-purpose flour", "replacement": "1:1 GF flour blend", ... }
  ],
  "warnings": ["This recipe contains eggs in the custard base which cannot be substituted"],
  "confidence": "high"
}
```
- **Loops:** 8-16 (complex multi-constraint reasoning)
- **Latency:** <5s
- **Fallback:** Static swap database if model unavailable

### Content Moderation (`/v1/recipe/moderate`)
```
POST /v1/recipe/moderate
Body: { "recipe": { ... }, "author": "user_123" }
Response: {
  "approved": true,
  "flags": [],
  "quality": { "hasIngredients": true, "hasInstructions": true, "isOriginal": true }
}
```
- **Loops:** 4-8 (moderate reasoning)
- **Latency:** <3s
- **Used for:** Community Table recipe submissions

### Health Check (`/v1/health`)
```
GET /v1/health
Response: { "status": "ok", "model": "mythos-3b", "loops": 16, "uptime": 86400 }
```

---

## Tailscale + Networking

```
Internet → Cloudflare (DDoS + SSL) → Tailscale → Mac Studio (Jerry)
                                              ↓
                                        Hetzner VPS (failover proxy)
                                              ↓
                                    Together AI / OpenRouter (cloud fallback)
```

- **Primary:** Mac Studio via Tailscale (`macstudio.<tailnet>.ts.net`)
- **Failover:** Hetzner CX22 VPS proxies to cloud API when Mac Studio is down
- **Monitoring:** UptimeRobot (5-min checks) → Telegram alert on outage

---

## Training Pipeline

### Phase 1: Base Model (Pre-trained)
- Start with Mythos-3B config from OpenMythos
- Pre-train on FineWeb-Edu + recipe corpora (1B tokens)
- Train the stability parameters (LTI injection) first

### Phase 2: Recipe Fine-Tuning
- Fine-tune on structured recipe extraction data
- Dataset: Recipe1M+ (1M+ recipes with structured ingredients/instructions)
- Custom dataset: dietary swap pairs (from our swap database, ~5000 examples)
- Custom dataset: community moderation labels (~2000 examples)

### Phase 3: Loop Count Calibration
- Benchmark loop counts vs quality for each task type
- Recipe extraction: 2-4 loops sufficient
- Dietary adaptation: 8-16 loops needed for multi-constraint reasoning
- Content moderation: 4-8 loops
- Set ACT halting thresholds per task

### Phase 4: Production Optimization
- 4-bit quantization (GPTQ or AWQ) for M4 Max
- MLX runtime for Apple Silicon optimization
- Batched inference for concurrent requests
- KV cache pooling for MLA efficiency

---

## Cost Projection

| Item | Cost | Notes |
|---|---|---|
| Mac Studio M4 Max 128GB | ~$4,000-5,000 | One-time, already considering |
| Hetzner VPS (failover) | ~$5/mo | CX22, proxy only |
| Cloud API fallback | ~$5-20/mo | Only when Mac Studio is down |
| Tailscale | Free | Personal use |
| Cloudflare | Free tier | DNS + DDoS |
| Domain (tableandtine.com) | ~$12/yr | Already owned? |
| **Total monthly (after hardware)** | **~$10-25** | Everything included |

Compare: Running equivalent cloud inference on Together AI at 200 users/day × 5 requests each × $0.002/request = **$600/month**. Jerry pays for itself in 7 months.

---

## Scaling Path

| Users | Model | Hardware | Monthly Cost |
|---|---|---|---|
| 0-1,000 | Mythos-3B (4-bit) | Mac Studio M4 Max | $10 (VPS only) |
| 1,000-10,000 | Mythos-3B (4-bit) | Mac Studio + caching | $15 |
| 10,000-50,000 | Mythos-10B (4-bit) | Mac Studio M4 Max | $20 |
| 50,000+ | Mythos-10B + Hetzner GPU | Mac Studio + cloud GPU | $100-300 |

The beauty of MoE + looped inference: you scale by adjusting loop counts, not by buying bigger models. 200 active users get 4 loops. 20 concurrent users doing complex dietary adaptations get 16 loops. Same hardware, adaptive compute.

---

## Next Steps

1. **Get the Mac Studio** — M4 Max, 128GB, 2TB
2. **Install MLX + OpenMythos** — Set up the inference runtime
3. **Fine-tune Mythos-3B** on domain-specific data (recipes, property analysis, financial data)
4. **Deploy Jerry API** — Swift/NIO or Node.js API layer
5. **Connect projects** — Table & Tine, JerryKnows AI, InspectAI, BogleAI
6. **Test with real traffic** — Start with 10 beta users, measure latency
7. **Add failover** — Hetzner VPS + cloud API backup

The formula: **one model, variable depth, adaptive compute, zero marginal cost.**