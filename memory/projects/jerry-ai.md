# Jerry — Local AI Project

**Name:** Jerry (official)
**Drive:** WD_BLACK SN7100 1TB NVMe SSD → `/Volumes/Frankenstein/`
**Models Path:** `/Volumes/Frankenstein/MLX-Models/`
**Python Env:** `~/mlx-env/` (Python 3.12 venv with vmlx)

## Hardware & Architecture (The Dual-Mac Setup)
The goal is to decouple the heavy AI workload from the daily development environment.

**1. The Backend "Brain" (Headless API Server):**
- **Mac Studio M3/M4 Ultra, 512GB Unified Memory, 4TB SSD**
- **Storage:** WD_BLACK SN7100 1TB NVMe (dedicated Jerry drive, APFS)
- Runs headless in the corner, hosting massive models (DeepSeek V4, Qwen) via MLX/LM Studio.
- Broadcasts an OpenAI-compatible local API endpoint (e.g., `http://192.168.1.100:1234/v1`).

**2. The Frontend Workstation (Daily Driver):**
- **Mac Mini M4 Pro, 64GB Unified Memory, 2TB SSD**
- Handles Xcode, VS Code/Cursor, Docker, Figma, and Unreal Engine 5.
- Connects to the Mac Studio over LAN for all AI capabilities (coding copilot, PR reviews, etc.) with zero latency and zero API cost, keeping the Mini cold and lightning fast for compiling and rendering.

## Models (Downloading)
| Model | Size | Purpose | Status |
|-------|------|---------|--------|
| DeepSeek V4 Flash 4-bit | 151.5 GB | Primary LLM (1T params, MoE 32B active) | ⬇️ Downloading |
| Qwen 3 235B 4-bit | 132.3 GB | Secondary LLM (fast coding/research) | ⬇️ Downloading |
| Flux Schnell 4-bit | 9.9 GB | Fast image generation | ⬇️ Downloading |
| Flux Dev 4-bit | 9.9 GB | High-quality image generation | ⬇️ Downloading |

## Software Installed
- vMLX 1.3.86 (app + CLI)
- vmlx Python package 1.3.86
- mlx, mlx-lm, mlx-vlm, mlx-embeddings, transformers, huggingface-hub

## Planned
- **Model merging:** MergeKit (TIES) — DeepSeek V4 + Qwen Coder + DeepSeek R1 reasoning
- **Fine-tuning:** LoRA via Unsloth or MLX Fine-tune, cloud GPU (RunPod ~$2/hr A100)
- **iOS integration:** Table & Tine app calls Jerry for recipe extraction
- **Orchestration:** MLX Studio — all-in-one local AI app
- **Unreal Engine 5 (UE5) Integration:** 
  - *Simulation Brain:* Use UE5's HTTP tools to send simulation data (environment, state) to the local Jerry API, which replies with JSON logic for simulated agents/NPCs in real-time.
  - *Development Copilot:* Jerry assists with C++ UE5 classes and Python editor scripting.

## Key Decisions
- All local AI, zero API costs, total privacy
- NVMe drive for fast model loading (~2-3 GB/s)
- No CUDA — use cloud GPU for fine-tuning only
- ~10-20 tok/s speed acceptable for personal use

## HuggingFace Note
- Currently using unauthenticated downloads (rate-limited)
- Consider adding HF_TOKEN for faster downloads
## Future Scaling (Clustering)
- **RDMA over Thunderbolt 5:** With macOS 16.2+ and Exo 1.0 / MLX Distributed, Macs can scale linearly using tensor parallelism (no speed degradation).
- **Hardware:** Requires Thunderbolt 5 (M4 Pro chips or higher). Base M4 only has TB4.
- **Strategy:** If Jerry outgrows the Studio's RAM, we can cluster it with other Thunderbolt 5 Macs (like an M4 Pro Mac Mini or another Studio) via a direct Thunderbolt mesh network to pool Unified Memory.
