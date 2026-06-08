# Kalshi Arbitrage Agent (Project K-Bot)

**Goal:** Build a fully automated, AI-driven trading agent for Kalshi (US CFTC-regulated prediction market) that exploits reasoning, speed, and discipline gaps.
**Architecture:** Python-based execution engine + Local AI (Jerry) reasoning engine.

## Phase 1: API & Infrastructure (The Skeleton)
- Create a developer account on Kalshi and generate API keys.
- Build a Python client to interact with the Kalshi REST and WebSocket APIs.
- **Milestone 1:** Successfully authenticate, pull live order book data for a specific market, and execute a paper trade (sandbox environment).

## Phase 2: The Reasoning Engine (Jerry Integration)
- Connect the Python client to the local Mac Studio (Jerry) API endpoint.
- Develop strict JSON-enforced prompts. 
  - *Example:* `Input: [Raw Fed Transcript]. Output strict JSON: {"market_id": "FED-01", "probability": 0.85, "confidence": 0.9}`.
- **Milestone 2:** The script pulls live text from a news feed (e.g., RSS, Twitter, or an economic calendar API), sends it to Jerry, and prints the calculated probability to the console.

## Phase 3: The Execution Logic (The Arbitrage)
- Implement the "Edge" calculation: `If (Jerry_Probability > Kalshi_Implied_Probability + Margin_of_Safety), then Buy Yes`.
- Implement strict risk management parameters (max position size, daily loss limit, max exposure per market category).
- **Milestone 3:** The bot successfully executes paper trades autonomously based on Jerry's reasoning, maintaining strict position sizing.

## Phase 4: Production
- Move from Kalshi Sandbox to Production.
- Deploy the Python execution engine to a stable environment (e.g., `jk-webteam-vps` or a dedicated low-latency droplet) while it calls Jerry over an encrypted tunnel.

## Target Markets (To Be Decided)
We need to pick one niche to dominate first. Options:
- **Macro Economics:** Fed rates, inflation data (requires high-speed text parsing of reports).
- **Weather/Climate:** Hurricanes, daily temperatures (requires integration with NOAA/Weather APIs).
- **Culture/Entertainment:** Box office numbers, Spotify streams (slower, but easier to model with social sentiment).

## Codebase Analysis & Strategy Pivot (Day Trader Mentality)
- **Repo Cloned:** `ryanfrigo/kalshi-ai-trading-bot` (Renamed to `project-k-bot`).
- **Initial Assessment:** The repo is extremely well-structured for generic trading, but currently relies too heavily on static math parameters (like the "Safe Compounder") or slow LLM guessing.
- **The Pivot (Day Trader Mode):**
  We will ignore his default "buy and hold" or category-scoring strategies. We want an aggressive, high-turnover **Event-Driven Day Trader**.
  1. **The Quick Flip Engine:** He actually has a `quick_flip_scalping.py` module in the repo. We will hijack this module.
  2. **News-Driven Triggers:** Instead of randomly buying 1-cent contracts, we will hook the bot into a high-speed news stream.
  3. **The Workflow:** When news breaks, Jerry instantly models the probability shift. If Jerry's probability is > current market, the bot executes a market buy, rides the human-FOMO price spike for a few minutes, and immediately auto-places a limit sell to capture the delta.

## Target Strategy: The S&P 500 Daily "End-of-Day" Scalp
- **The Core Inefficiency:** Humans are terrible at calculating exact closing probabilities during the chaotic final 30 minutes of the stock market trading day (3:30 PM - 4:00 PM EST).
- **The Data Pipeline:**
  - Hook into a high-speed stock API (e.g., Alpaca, Polygon.io, or Yahoo Finance API) for real-time SPX/NDX spot prices.
  - Pull the current "Daily Close" contract prices from the Kalshi order book.
- **The AI / Math Edge:** 
  - Jerry (or a local Python statistics script) constantly calculates the exact probability of the index crossing a specific strike price given the time remaining and the current volatility index (VIX).
  - If the human-traded Kalshi price is significantly lower than our mathematical probability (e.g., humans are panicking and selling a contract for 20 cents that our math says has an 80% chance of clearing), the bot auto-buys.
  - The bot holds for the final minutes and lets the contract settle at $1.00 (or flips it if human FOMO drives the price above our probability curve).

## Overnight Test (BTC/Crypto 24/7 Markets)
- **Goal:** Run the bot overnight using Brainwave to predict Kalshi Crypto markets (which trade 24/7).
- **Data Feeds:**
  1. Live Spot Price (CoinGecko / Binance public API for real-time BTC price).
  2. Live News/Sentiment: We will leverage the repo's existing `news_aggregator.py` to pull RSS feeds (CoinDesk, Bloomberg Crypto) so Brainwave has context for sudden price movements.
- **Workflow:** Every 15 minutes, pull spot price + latest 5 headlines -> Send to Brainwave -> Calculate Probability -> Paper Trade on Kalshi.

## Strategic Pivot: The Prop Desk Model
- **Focus:** The "Live-Event Proprietary Trading Desk" (Option 2).
- **Goal:** Short-term, aggressive capital accumulation. Build, scale, and run as fast as possible to exploit the current speed/reasoning gaps in prediction markets before institutional/algorithmic competition completely erases the margins.
- **Why Prop Trading?** 
  - Zero client acquisition needed.
  - Zero compliance/sales friction (unlike the Thrivent model).
  - Scalability is limited only by API latency and Kalshi market liquidity.
- **The Playbook:**
  1. Prove the math/probability edge with Project K-Bot (Overnight BTC / S&P Scalp).
  2. Transition from Paper Trading to Live Funds.
  3. Reinvest profits to expand into multi-market, sub-second execution.

## Revenue Goal & Scaling Strategy
- **Initial Target:** $500 / day in consistent, low-risk scalping profit.
- **Methodology:** Do not swing for massive "all-in" wins. Focus entirely on high-frequency, small-edge scalping (e.g., buying at 15 cents, selling at 25 cents). 
- **Bankroll Mechanics:** Once the bankroll grows from the initial $102 to a size that supports larger contract volumes without breaking the risk parameters, the $500/day target becomes achievable through scale. We will cap risk exposure strictly until this baseline is hit.
