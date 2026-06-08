# Frankenstein AI — Build Blueprint

**Category:** AI

**Goal:** Build a custom AI on Mac Studio (512GB RAM, 4TB SSD) that competes with ChatGPT/Claude for coding, image generation, and research — all local, zero API costs.

**Date:** April 25, 2026

---

## The Hardware

**Mac Studio M4 Ultra, 512GB unified memory, 4TB SSD**
- 819 GB/s memory bandwidth
- Can run models up to ~430GB (Q8_0 405B) with room for OS
- 50-80W power draw under load
- Competes with $50K+ NVIDIA setups for single-user inference

---

## What Can Run on This Machine

| Model | Params | Quant | Memory | Speed | Use |
|---|---|---|---|---|---|
| DeepSeek V3 671B | MoE (37B active) | Q4_K_M | ~350GB | ~15-20 tok/s | General intelligence, research |
| DeepSeek V4 1T | MoE (32B active) | Q4 | ~400GB (est.) | ~10-15 tok/s (est.) | Multimodal, 1M context |
| Llama 3.1 405B | Dense | Q5_K_M | ~290GB | ~3-5 tok/s | Coding, reasoning |
| Qwen 3 235B | Dense | Q4_K_M | ~140GB | ~8-12 tok/s | Best speed/quality ratio |
| Qwen 3.5 Coder 32B | Dense | Q8_0 | ~35GB | ~35 tok/s | Fast coding |
| DeepSeek R1 70B | Dense | Q8_0 | ~75GB | ~10-15 tok/s | Reasoning |
| 3-4 models simultaneously | Various | Various | ~142GB total | Varies | AI team |

---

## The Build: 3-Layer Architecture

### Layer 1: The Brain (Text LLM)

**Primary: DeepSeek V4** (just released April 2026!)
- 1T params, 32B active per token (MoE)
- Native multimodal: text + image + video + audio
- 1M token context window
- Apache 2.0 license
- Engram Memory System (selective context retention)
- Competitive with GPT-5 on most benchmarks
- ~$0.15/M input tokens via API, or FREE locally

**Fallback/Secondary: Qwen 3 235B**
- Faster response time for quick tasks
- Excellent coding abilities
- Runs alongside V4 with memory to spare

### Layer 2: The Artist (Image Generation)

**Flux via MLX Studio** (runs natively on Apple Silicon)
- Flux Schnell: 1024×1024 in seconds
- Flux Dev: Higher quality, slightly slower
- Flux Kontext: Image editing/inpainting
- Flux Fill: Outpainting
- Qwen Image Edit: Instruction-based editing
- Z-Image Turbo: Fast generation
- Klein 4B/9B: Lightweight options

**Stable Diffusion XL / SD3** via Draw Things or ComfyUI
- More model options, LoRA support
- Better for specific art styles

### Layer 3: The Agent Shell (Orchestration)

**MLX Studio** — The all-in-one local AI app
- Chat, code, generate images, voice — all local
- 20+ built-in agentic tools (file I/O, code search, shell, web search, git)
- Both Anthropic + OpenAI API endpoints
- 5-layer caching (prefix, paged KV, KV quant, continuous batching, disk)
- Speculative decoding for 20-90% speed boost
- MCP server support
- Free, code-signed, notarized

**Alternative: Ollama** for simpler serving
- `ollama serve` → OpenAI-compatible API
- Dead simple model management
- Less features than MLX Studio but rock solid

---

## The Frankenstein Merge

Use **MergeKit** to combine strengths from multiple models:

### Recipe: "Gathered Mind" (working name)

```yaml
# mergekit config (conceptual)
models:
  - model: deepseek-ai/DeepSeek-V4  # Base: multimodal, 1M context, general intelligence
    parameters:
      weight: 0.6
  - model: Qwen/Qwen3.5-Coder-32B   # Coding specialist
    parameters:
      weight: 0.25
  - model: deepseek-ai/DeepSeek-R1-70B  # Reasoning specialist
    parameters:
      weight: 0.15
merge_method: ties  # TIES keeps strongest signals from each model
base_model: deepseek-ai/DeepSeek-V4
dtype: bfloat16
```

**Merge methods to test:**
1. **TIES** — Best for combining different capabilities (recommended first)
2. **DARE** — Good for dropping redundant weights, keeping unique strengths
3. **SLERP** — Smooth blend between 2 models (good for pairs)

**Merge workflow:**
1. Start with DeepSeek V4 as base
2. Merge in coding strengths from Qwen Coder
3. Merge in reasoning strengths from DeepSeek R1
4. Test on benchmarks, iterate
5. Fine-tune with LoRA on your specific use cases

---

## Fine-Tuning with LoRA

**What to fine-tune on:**
- Recipe extraction data (for Gathered Table)
- Your personal coding style and patterns
- Domain knowledge you care about
- Custom personality/tone preferences

**Tools:**
- **Unsloth** — Fast LoRA fine-tuning, works on single GPU
- **MLX Fine-tune** — Apple Silicon native fine-tuning
- **RunPod** — Cloud GPU rental for training ($2/hr A100)

**Process:**
1. Prepare dataset (JSONL format, instruction-response pairs)
2. Run LoRA fine-tune (rank 16-64, 3-5 epochs)
3. Merge LoRA weights back into base model
4. Quantize to Q4_K_M for serving
5. Test and iterate

---

## Step-by-Step Build Order

### Phase 1: Get Running (Day 1)
1. Install MLX Studio from mlx.studio
2. Pull DeepSeek V4 (or V3 if V4 weights aren't on HuggingFace yet)
3. Pull Qwen 3 235B as secondary
4. Pull Flux Schnell for image generation
5. Test all three simultaneously
6. Configure OpenAI-compatible API endpoint for app integration

### Phase 2: Optimize (Week 1)
1. Try JANG quantization for better quality at same memory
2. Enable speculative decoding (small draft model → faster big model)
3. Set up KV cache quantization
4. Benchmark and tune for your workload
5. Set up Ollama as secondary API endpoint

### Phase 3: Frankenstein (Weeks 2-3)
1. Install MergeKit (`pip install mergekit`)
2. Create merge config (TIES method)
3. Run merge on cloud GPU (RunPod A100, ~$2/hr, ~4-8 hours)
4. Quantize merged model to Q4_K_M
5. Test vs individual models on your tasks
6. Iterate on merge recipe

### Phase 4: Fine-Tune (Week 4)
1. Build training dataset (recipes, coding patterns, domain knowledge)
2. Run LoRA fine-tune on RunPod or locally with MLX
3. Merge LoRA adapter into model
4. Quantize and serve
5. Your custom AI is live

### Phase 5: Production (Ongoing)
1. Wire up to Gathered Table app for recipe extraction
2. Use as daily coding assistant
3. Image generation for any creative work
4. Research and analysis at scale (1M context!)
5. Zero API costs forever

---

## Cost Estimate

| Item | Cost |
|---|---|
| Mac Studio (already have) | $0 |
| Cloud GPU for merge (RunPod) | ~$50-100 |
| Cloud GPU for LoRA fine-tune | ~$30-60 |
| MLX Studio | Free |
| Models (open source) | Free |
| **Total additional cost** | **~$80-160** |

**vs. Cloud API costs:**
- GPT-5 at $8/M input: A heavy user doing 50M tokens/month = $400/month = $4,800/year
- Your local model: $0/month forever
- **Payback: < 1 month**

---

## The Honest Trade-offs

**Wins:**
- Zero ongoing API costs
- Total privacy (nothing leaves your machine)
- No rate limits
- Custom personality and capabilities
- 1M token context window (V4)
- Runs 24/7 as your personal AI server

**Trade-offs:**
- Speed: 10-20 tok/s vs 50-100+ on cloud APIs
- No CUDA training ecosystem (fine-tuning is slower on Mac)
- Merge quality is trial-and-error
- Community support is smaller than Claude/GPT
- V4 is brand new — less battle-tested

**The bottom line:**
This build gives you 80-90% of ChatGPT/Claude quality at $0 marginal cost, with total privacy and customization. The 10-20% gap is mainly in coding (where Claude still leads) and speed. For everything else — research, writing, analysis, image generation, recipe parsing — it's competitive right now.

---

## Key Resources

- **MLX Studio**: https://mlx.studio/
- **MergeKit**: https://github.com/arcee-ai/mergekit
- **Unsloth**: https://github.com/unslothai/unsloth
- **JANG Quantization**: https://jangq.ai/
- **DeepSeek V4**: https://huggingface.co/deepseek-ai
- **Qwen 3**: https://huggingface.co/Qwen
- **RunPod** (cloud GPU): https://runpod.io
- **Ollama**: https://ollama.ai
- **canitrun.net** (model compatibility checker): https://canitrun.net/