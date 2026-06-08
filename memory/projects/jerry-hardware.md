# Jerry Hardware Discussion — April 25, 2026

## Context

Jon asked about hardware for running Jerry (local AI assistant). The discussion covered current Mac Studio options, M5 rumors, and what's needed to run Jerry's full model stack efficiently.

## Jerry's Model Stack (Current Plan)

### Always Loaded (~36GB)
| Model | Size | Speed | Role |
|-------|------|-------|------|
| SmolLM3 3B | ~2GB | 80-120 tok/s | Router — classifies requests, dispatches to specialists |
| Qwen 3 8B | ~5GB | 60-90 tok/s | Workhorse — structured JSON, quick Q&A, classification |
| Qwen3-Coder-30B-A3B | ~17GB | 60-90 tok/s | Code generation, agentic coding, tool use (MoE: 3B active) |
| Whisper Small | ~0.5GB | 2× real-time | Voice transcription |
| bge-large + MiniLM | ~1.5GB | Fast | Embeddings, semantic search, RAG |
| Flux Schnell | ~10GB | ~2s/image | Fast image generation |

### On-Demand (~284GB)
| Model | Size | Speed | Role |
|-------|------|-------|------|
| DeepSeek V4 Flash 4-bit | ~152GB | 10-15 tok/s | Deep reasoning, analysis, long-form writing, math |
| Qwen 3 235B 4-bit | ~132GB | 12-20 tok/s | Coding, research, multilingual, structured output |

### Memory Budget
| Tier | Models Loaded | Memory Used | Free (512GB) |
|------|--------------|-------------|---------------|
| Idle (always on) | Router + Small models | ~3GB | 509GB |
| Light (daily use) | + Qwen 8B, Coder, Embeddings, Flux | ~36GB | 476GB |
| Heavy (deep work) | + DeepSeek V4 OR Qwen 235B | ~188-208GB | 304-324GB |
| Max (everything) | All models loaded simultaneously | ~320GB | 192GB |

## Hardware Options Discussed

### Option 1: Single M3 Ultra 256GB (~$8,000)
- ✅ Runs all small models + one big model at a time
- ✅ 80% of requests handled by small models at 60-120 tok/s
- ⚠️ Need to swap between DeepSeek and Qwen 235B (~30s load from NVMe)
- ⚠️ Can't run both big models simultaneously
- ✅ Most cost-effective entry point

### Option 2: 2× M3 Ultra 256GB Cluster (~$16,000)
- ✅ Both big models loaded simultaneously on separate machines
- ✅ Parallel deep reasoning — zero contention
- ✅ One can be 24/7 "always on" Jerry, other is daily driver
- ✅ Redundancy if one needs reboot
- ⚠️ MLX doesn't support distributed inference (can't split one model across two Macs)
- ⚠️ Task distribution, not model splitting — each model runs entirely on one machine

### Option 3: M3 Ultra 256GB + Used M2 Ultra 192GB Mix (~$11,500)
- ✅ Cheaper entry to dual-machine setup
- ⚠️ M2 Ultra is slower per-core than M3
- ⚠️ 192GB limit means only one big model at a time on the M2

### Option 4: Single M3 Ultra 512GB (~$8,000-10,000 depending on config)
- ✅ Both big models loaded simultaneously (284GB fits in 512GB with room)
- ✅ Zero model swapping — everything in RAM all the time
- ✅ Instant response for all requests
- ⚠️ Currently hard to find — Apple discontinued 512GB config due to RAM shortages
- ⚠️ Need to find used/refurbished units

## Recommendation

**Start with one M3 Ultra 512GB.** This is the sweet spot:
- All models loaded, all the time
- Zero swapping
- Instant response for 80% of requests (small models)
- DeepSeek and Qwen 235B both available without delay
- When M5 Studio drops, either keep using M3 or sell and upgrade

Jon confirmed he has 3-5 used M3 Ultra 512GB units available.

## M5 Studio Rumors (as of April 2026)

- **Expected:** WWDC June 8, 2026 or later this year
- **M5 Ultra:** 36-core CPU, 80-core GPU (two M5 Max dies linked)
- **M5 Max:** 18-core CPU, 40-core GPU
- **Max RAM: 256GB** (likely — 512GB discontinued due to global RAM shortage)
- **2× faster SSD** vs M4 generation
- **Same design** as current Mac Studio
- **Mac Pro discontinued** — Mac Studio is now Apple's only pro desktop
- **RAM shortage is real** — 4-5 month shipping delays on current high-RAM configs
- **Pricing:** May increase from current $1,999 starting price

### Key Concern: 256GB RAM Limit
If M5 Ultra maxes at 256GB, that's the same ceiling as the current M3 Ultra. Jerry's two big models (152GB + 132GB = 284GB) can't both stay loaded. You'd still need model swapping — just faster swapping due to the faster SSD.

**A 512GB M3 Ultra today > a 256GB M5 Ultra later** for Jerry's use case, because RAM capacity matters more than CPU speed for LLM inference.

## Key Insight: Why 512GB Matters

Jerry's architecture is designed around the 80/20 rule:
- 80% of requests → small models (instant response, <1s)
- 20% of requests → big models (deep reasoning, 10-15 tok/s)

With 512GB, both big models stay loaded = **zero wait time** for any request.
With 256GB, big models need to swap = **15-30s delay** when switching between DeepSeek and Qwen.

For a personal assistant that should feel instant, zero-swapping is the right experience.

## Jerry Architecture Diagram

```
User Input → SmolLM3 3B (Router) → Route to specialist
                                       ├─ Simple Q&A → Qwen 3 8B (fast)
                                       ├─ Tool/Function call → Qwen 3 8B (fast)
                                       ├─ Code → Qwen3-Coder-30B-A3B (fast, MoE)
                                       ├─ Deep reasoning → DeepSeek V4 (loaded, ready)
                                       ├─ Complex code → Qwen 3 235B (loaded, ready)
                                       ├─ Image generation → Flux Schnell or Flux Dev
                                       └─ Voice input → Whisper → then route text
```

## Download Status (April 25, 2026)

| Model | Status | Size |
|-------|--------|------|
| Flux Schnell 4-bit | ✅ Complete | 9.2GB |
| Flux Dev 4-bit | ✅ Complete | 9.2GB |
| Qwen3-Coder-30B-A3B 4-bit | ✅ Complete | 16GB |
| DeepSeek V4 Flash 4-bit | ⏳ 78% (32/41 files) | ~152GB total |
| Qwen 3 235B 4-bit | ⏸️ Paused (auto-restarts after DeepSeek) | ~132GB total |

All models stored on `/Volumes/Frankenstein/` (WD_BLACK SN7100 1TB NVMe).

## Files Referenced
- Jerry architecture doc: `memory/projects/jerry-architecture.md`
- Jerry project doc: `memory/projects/jerry-ai.md`
- Daily notes: `memory/2026-04-25.md`
- Jerry Framework doc: `memory/projects/jerry-framework.md`