# Jerry — Model Architecture

**Category:** AI

## Philosophy: Right Model, Right Job

Jerry isn't one model — it's a **team of specialists**. Each model does what it's best at, routed by a lightweight orchestrator. Small models handle 80% of requests at 50-90 tok/s. Big models handle the 20% that need deep reasoning or complex generation.

## The Team

### 🧠 Heavy Hitters (Big Brain)
| Model | Size (4-bit) | Speed (M4 Ultra) | Best At |
|-------|-------------|-------------------|---------|
| DeepSeek V4 Flash | ~151 GB | 10-15 tok/s | Deep reasoning, analysis, long-form writing, math, complex Q&A |
| Qwen 3 235B | ~132 GB | 12-20 tok/s | Coding, research, multilingual, structured output, tool use |

**When to wake them:** Complex reasoning, multi-step problems, code generation, long documents, anything requiring deep understanding.

### ⚡ Specialists (Fast Lane)
| Model | Size | Speed (M4 Ultra) | Best At |
|-------|------|-------------------|---------|
| Qwen 3 8B | ~5 GB | 60-90 tok/s | Tool/function calling, structured JSON extraction, quick Q&A, classification |
| Qwen3-Coder-30B-A3B | ~17 GB | 60-90 tok/s | **Code generation, code completion, agentic coding, tool use** |
| SmolLM3 3B | ~2 GB | 80-120 tok/s | Ultra-fast routing, intent classification, simple extraction |
| Gemma 3 4B | ~3 GB | 70-100 tok/s | General chat, summarization, lightweight instruction following |

**Always loaded, always fast.** These run at 60-120 tok/s — faster than you can read.

### 🎨 Vision & Media
| Model | Size | Speed | Best At |
|-------|------|-------|---------|
| Flux Schnell | ~10 GB | ~2s/image | Fast image generation (draft/quick) |
| Flux Dev | ~10 GB | ~8s/image | High-quality image generation |
| Whisper Large v3 | ~3 GB | Real-time | Speech-to-text transcription |
| Whisper Small | ~0.5 GB | 2x real-time | Ultra-fast transcription (voice commands) |

### 🔍 Embeddings & Search
| Model | Size | Best At |
|-------|------|---------|
| bge-large (MLX) | ~1.3 GB | Semantic search, RAG, document similarity |
| all-MiniLM-L6 (MLX) | ~0.2 GB | Ultra-fast similarity, dedup, clustering |

## The Router (Jerry's Brain Stem)

The router is the smallest, fastest model — always loaded, always running. It decides which specialist handles each request.

```
User Input → SmolLM3 3B (Router) → Route to specialist
                                       ├─ Simple Q&A → Gemma 3 4B
                                       ├─ Tool/Function call → Qwen 3 8B
                                       ├─ Structured extraction → Qwen 3 8B
                                       ├─ Code → Qwen3-Coder-30B-A3B (fast) or Qwen 3 235B (deep)
                                       ├─ Deep reasoning → DeepSeek V4
                                       ├─ Image generation → Flux
                                       └─ Voice input → Whisper → then route text
```

## Task → Model Mapping for Gathered Table

| App Task | Model | Why |
|----------|-------|-----|
| Recipe URL extraction | Qwen 3 8B | Fast structured JSON, cheap |
| Photo OCR → recipe parsing | Qwen 3 8B + GLiNER2 | Extract structured data from OCR text |
| Voice dictation | Whisper Small → Qwen 3 8B | Transcribe → format as recipe |
| Smart search / find similar recipes | bge-large embeddings | Vector similarity, not LLM |
| Recipe suggestions | Gemma 3 4B | Quick creative suggestions |
| Cookbook generation/layout | DeepSeek V4 | Complex multi-step reasoning |
| Code generation (app code) | Qwen3-Coder-30B-A3B | Purpose-built for code, fast |
| Image generation (food photos) | Flux Schnell | Fast, good enough for food |
| Nutrition estimation | Qwen 3 8B | Structured output, fast |

## Memory Budget (M4 Ultra 512GB)

| Tier | Models Loaded | Memory Used | Free |
|------|--------------|-------------|------|
| **Idle** (always on) | SmolLM3 3B, Whisper Small, MiniLM | ~3 GB | 509 GB |
| **Light** (daily use) | + Qwen 3 8B, Qwen3-Coder-30B-A3B, bge-large, Flux Schnell | ~37 GB | 475 GB |
| **Heavy** (deep work) | + DeepSeek V4 Flash or Qwen 235B | ~170 GB | 322 GB |
| **Max** (everything) | DeepSeek V4 + Qwen 235B + all fast models | ~310 GB | 202 GB |

**Key insight:** Fast models stay loaded permanently. Big models load/unload as needed. With NVMe at 2-3 GB/s, a 150GB model loads in ~60 seconds.

## Implementation Roadmap

1. **Week 1:** Install all models, get vmlx serving each one
2. **Week 2:** Build the router (SmolLM3) with classification logic
3. **Week 3:** Wire Gathered Table to call Jerry API endpoints
4. **Week 4:** Tune routing thresholds, add fallback logic
5. **Month 2:** Merge models via MergeKit, fine-tune on recipe data
6. **Month 3:** Build Jerry as a product (API + dashboard + app)

## Why This Beats One Big Model

- **Cost:** Small models run at 60-120 tok/s vs 10-15 tok/s for the big ones
- **Latency:** 80% of queries answered in <1 second
- **Power:** Small models use ~20W, big models use ~100W+ 
- **Parallelism:** Qwen 8B handles extraction while DeepSeek V4 reasons on something else
- **Specialization:** Each model is the best in class at its job, not a jack of all trades