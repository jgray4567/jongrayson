# Jerry + Gathered Table: Infrastructure & Redundancy Plan

## Overview

This document covers the full setup for running Jerry (MLX LLM inference) on Jon's Mac Studio and serving Gathered Table app traffic, with automatic failover to a cloud VPS.

---

## Part 1: Tailscale Setup (Primary Connection)

### Why Tailscale
- No port forwarding, no static IP, no DDNS
- Encrypted WireGuard tunnel (zero config)
- Works through any NAT/firewall
- Free for personal use (up to 100 devices)
- MagicDNS gives stable addresses that never change

### Step 1: Create Tailscale Account

1. Go to https://login.tailscale.com/start
2. Sign up with Google/GitHub/Microsoft
3. Note your tailnet name (e.g., `tailnet123.ts.net`)

### Step 2: Install on Mac Studio (Jerry)

```bash
# Install Tailscale
brew install tailscale

# Or download from https://tailscale.com/download/mac

# Start the daemon
sudo tailscale up

# It will open a browser — log in with your Tailscale account
# Accept the default settings
```

After login, your Mac Studio gets a stable Tailscale IP and hostname:
- **IP:** `100.x.y.z` (Tailscale CGNAT range)
- **Hostname:** `macstudio.<tailnet>.ts.net`
- **This address never changes**

### Step 3: Install on Your Other Devices

Install Tailscale on every device you want to access Jerry from:
- **iPhone/iPad:** App Store → Tailscale
- **MacBook:** `brew install tailscale` or download from tailscale.com
- **Any other machine:** Download from tailscale.com

All devices on the same tailnet can reach each other by hostname.

### Step 4: Hardwire the Mac Studio

1. Run Cat6 Ethernet from Mac Studio → router/switch
2. In macOS System Settings → Network:
   - Set Ethernet as primary (drag to top of service order)
   - Set "Configure IPv4" to "Using DHCP" (your router assigns a local IP)
3. Verify: `curl -4 ifconfig.me` should show your Fios public IP

### Step 5: Configure DNS for api.jerryknows.ai

**Option A: Tailscale MagicDNS (simplest)**
- Your Mac Studio is reachable at `macstudio.<tailnet>.ts.net`
- Only accessible from devices on your tailnet (perfect for development)

**Option B: Public DNS with Cloudflare (for production app users)**
1. Add `api.jerryknows.ai` DNS record in Cloudflare:
   - Type: `A`
   - Name: `api`
   - Content: Your Fios public IP (find with `curl -4 ifconfig.me`)
   - Proxy: **Enabled** (orange cloud) for DDoS protection
2. Cloudflare handles SSL termination and forwards to your Mac Studio

**Option C: Tailscale Funnel (no Cloudflare needed)**
```bash
# Expose a service publicly through Tailscale's edge network
tailscale serve https / http://127.0.0.1:8080
tailscale funnel https
```
This makes `macstudio.<tailnet>.ts.net` publicly accessible on port 443. No Cloudflare, no port forwarding.

---

## Part 2: Jerry API Server Setup

### Configure the Recipe Extraction Endpoint

The Jerry API server needs to listen on a local port and be accessible via Tailscale:

```bash
# On Mac Studio, Jerry API should listen on:
# - 127.0.0.1:8080 (local only)
# OR
# - 0.0.0.0:8080 (all interfaces, including Tailscale)
```

### Tailscale Serve (Recommended)

This creates a TLS-terminated reverse proxy with automatic HTTPS:

```bash
# Proxy HTTPS traffic to your local Jerry API
tailscale serve https / http://127.0.0.1:8080

# Optionally make it publicly accessible
tailscale funnel https
```

Now `macstudio.<tailnet>.ts.net` proxies to `localhost:8080` with automatic TLS.

### Update Gathered Table App

In `RecipeExtractionService.swift`, the baseURL is already swappable:

```swift
// Production (point to Jerry at home)
static var baseURL = URL(string: "https://api.jerryknows.ai/v1")!

// Development (local)
static var baseURL = URL(string: "http://localhost:8080/v1")!

// Tailscale direct
static var baseURL = URL(string: "https://macstudio.<tailnet>.ts.net/v1")!
```

---

## Part 3: Redundancy & Failover

### Architecture

```
                    ┌─────────────────────────────┐
                    │       Cloudflare DNS         │
                    │   api.jerryknows.ai           │
                    └──────────┬──────────────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │    Cloudflare (proxy mode)   │
                    │   DDoS protection + SSL      │
                    └──────────┬──────────────────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
    ┌──────────▼────┐  ┌──────▼──────┐  ┌─────▼─────────┐
    │  PRIMARY      │  │  FALLBACK   │  │  FALLBACK     │
    │  Mac Studio   │  │  VPS        │  │  JerryKnows   │
    │  (Home Fios)  │  │  (Hetzner/  │  │  Cloud API   │
    │  MLX models   │  │   DigitalOc) │  │  (always up) │
    │  Port 443     │  │  Port 443    │  │              │
    └───────────────┘  └─────────────┘  └──────────────┘
```

### Failover Strategy

**Tier 1: Mac Studio (Home)** — Primary
- Full MLX inference, all models loaded
- Fastest response, zero marginal cost
- Uptime: ~99% (Fios is reliable, but power outages happen)

**Tier 2: VPS (Cloud)** — Hot Standby
- Small VPS runs a lightweight API proxy
- No local models — proxies to Tier 3 cloud API
- $5-7/month
- Uptime: 99.9%+

**Tier 3: Cloud LLM API** — Always Available
- OpenRouter, Together AI, or Anthropic API
- Gathered Table app tries this last (or as fallback)
- Pay-per-token, ~$5-20/month for recipe extraction volumes
- Uptime: 99.99%+

### Recommended VPS Options for Tier 2

| Provider | Plan | Cost | Specs | Notes |
|----------|------|------|-------|-------|
| **Hetzner** | CX22 | ~€5/mo | 2 vCPU, 4GB RAM | Best value, German reliability |
| **DigitalOcean** | Basic | $6/mo | 1 vCPU, 1GB RAM | Simple, good API |
| **Linode/Akamai** | Nanode | $5/mo | 1 vCPU, 1GB RAM | Long track record |
| **Vultr** | Regular | $5/mo | 1 vCPU, 1GB RAM | Good global presence |

**Hetzner CX22 is my pick** — more RAM (4GB) for the same price, which matters if you want to run a small model there later.

### VPS Fallback Configuration

```bash
# On the VPS, install:
# 1. Tailscale (same tailnet as Mac Studio)
# 2. Caddy (reverse proxy with auto-HTTPS)
# 3. Node.js or Python (simple API proxy)

# Caddyfile
api.jerryknows.ai {
    # Try Mac Studio first via Tailscale
    reverse_proxy macstudio.<tailnet>.ts.net:443 {
        # If Mac Studio is down, fall back to cloud API
        try_fallback {
            to https://api.together.xyz/v1
            fail_timeout 5s
        }
    }
}
```

### App-Side Failover (Already Built In)

The `RecipeExtractionService.swift` already has error handling that creates a basic draft on failure. To add automatic cloud fallback:

```swift
// In RecipeExtractionService.swift, add fallback URLs
static var fallbackURLs: [URL] = [
    URL(string: "https://api.jerryknows.ai/v1")!,  // Mac Studio
    URL(string: "https://fallback.jerryknows.ai/v1")!,  // VPS proxy
    // Cloud API handled separately
]

func extractRecipe(from url: String) async throws -> ExtractedRecipe {
    // Try primary, then fallback, then create manual draft
    for baseURL in Self.fallbackURLs {
        do {
            return try await performExtraction(url: url, baseURL: baseURL)
        } catch {
            continue // Try next
        }
    }
    // All failed — return basic draft for manual editing
    return ExtractedRecipe.fallback(url: url)
}
```

---

## Part 4: Monitoring & Alerting

### Health Check (Built In)

`RecipeExtractionService` already has a health check endpoint:

```swift
static let healthURL = URL(string: baseURL.absoluteString + "/health")!
```

### Simple Uptime Monitor

Create a free account on UptimeRobot (https://uptimerobot.com):
1. Add monitor: `https://api.jerryknows.ai/v1/health`
2. Check interval: 5 minutes
3. Alert via: Telegram, email, Slack
4. When primary goes down → you get notified → VPS fallback serves traffic

### Tailscale Status

```bash
# Check if Mac Studio is online
tailscale status

# Output looks like:
# 100.x.y.z   macstudio  jon@      linux   -
# 100.a.b.c   iphone     jon@      iOS     -
```

---

## Part 5: Quick Setup Checklist

### Today (30 minutes)
- [ ] Install Tailscale on Mac Studio (`brew install tailscale`)
- [ ] Run `tailscale up` and log in
- [ ] Install Tailscale on iPhone
- [ ] Verify: `ping macstudio.<tailnet>.ts.net` from iPhone
- [ ] Hardwire Mac Studio to router via Ethernet

### This Week (2-3 hours)
- [ ] Set up Jerry API server on Mac Studio (port 8080)
- [ ] Configure `tailscale serve` to proxy HTTPS → localhost:8080
- [ ] Test: `curl https://macstudio.<tailnet>.ts.net/v1/health` from iPhone
- [ ] Add Cloudflare DNS record for `api.jerryknows.ai`
- [ ] Enable Cloudflare proxy (orange cloud)
- [ ] Update `RecipeExtractionService.swift` baseURL to `https://api.jerryknows.ai/v1`
- [ ] Test Gathered Table URL import end-to-end

### Next Week (1-2 hours)
- [ ] Set up Hetzner CX22 VPS
- [ ] Install Tailscale + Caddy on VPS
- [ ] Configure failover proxy (Mac Studio → cloud API)
- [ ] Sign up for UptimeRobot
- [ ] Add health check monitoring

### When Jerry Hardware Arrives
- [ ] Install MLX models on Mac Studio
- [ ] Set up SmolLM3 router for request classification
- [ ] Wire local inference into Gathered Table
- [ ] Cloud API becomes Tier 3 fallback only

---

## Cost Summary

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Mac Studio | Already owned | Primary server |
| Fios Internet | Already paying | Primary connection |
| Tailscale | Free (personal) | VPN mesh |
| Cloudflare | Free tier | DNS + DDoS protection |
| Hetzner VPS | ~$5/mo | Fallback proxy |
| Together AI API | ~$5-20/mo | Cloud LLM fallback |
| UptimeRobot | Free | Monitoring |
| **Total additional** | **~$10-25/mo** | Everything included |

Compare to running full 8×H100 in cloud: **$12,800/mo**. You're saving over $12,700/month by running locally with smart failover.