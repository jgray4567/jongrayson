# Polymarket Trading & Safe Compounder

**Category:** AI

## Overview
- **Wallet Setup:** Configured a Polymarket proxy wallet for Jon.
  - EOA Address: `0x9d74e37Bde55f0e0C5EA27B96ae28585DAfC3858`
  - Proxy Wallet: `0x8bf0160d3b38FaE47b5F57de74d29DFEC0BF68E0`
- **Funding:** 
  - MATIC (~182 tokens) successfully arrived in the EOA for gas.
  - Jon transferred ~146.34 USDC from Coinbase. However, it was sent as `USDC.e` (Bridged USDC contract: `0x3c49...`) rather than native `USDC` (`0x2791...`).
- **Next Steps:** 
  - Need to swap the `USDC.e` to native `USDC` so the Polymarket CLI can use it.
  - Jon wants to create a Polymarket adaptation of his `safe_compounder.py` bot. Started scaffolding in `polymarket-bots/safe-compounder`.

## 2026-05-06
- Jon ended the session for the night. Will resume in the AM to finish swapping the tokens and writing the bot logic.
## 2026-05-12
- Investigated the K-Bot Kalshi bots making poor decisions and hitting errors.
- The `overnight_btc_bot.py` generated massive paper losses (-$117k) over several days because its failsafe was commented out. It kept logging paper positions every few minutes based on slightly bullish Claude responses (0.55/0.60) and tracking the resulting underwater BTC spot trades.
- The `live_compounder.py` was stuck in a loop continuously throwing `insufficient_balance` HTTP 400 errors from Kalshi because the account only had $3.80 in available cash.
- **Action Taken:** Killed all running Python bot processes (`overnight_btc_bot.py`, `live_compounder.py`, `safe_compounder.py`, etc.) to stop the bleed and the error spam.
