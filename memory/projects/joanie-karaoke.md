# Joanie Karaoke

**Category:** Application

## Overview
Karaoke DJ (KJ) app project. Research phase started April 2026.

## Market Research
Full competitive analysis saved in: `JoanieKaraoke/` (see karaoke-dj-app-research.md at workspace root)

### Key Market Gaps
1. Mac support is terrible — most KJ software is Windows-only
2. UIs look like 2010 software
3. No mobile-first KJ app (iPad would be huge)
4. No AI features (auto-key suggestion, smart rotation, analytics)
5. Request systems are fragmented and each costs extra
6. Break music management is an afterthought
7. Zero analytics/reporting for venues

### Top Competitors
- **PCDJ LYRX** — $40 one-time + $50/mo catalog. Industry standard, Windows only.
- **Siglos Karaoke Professional** — $119 one-time. YouTube integration, deep show management, Windows only.
- **SongBoss** — Free, cross-platform. Newcomer, modern rotation, small community.
- **VirtualDJ** — $19/mo or $299 lifetime. Best DJ+KJ hybrid.
- **KaraFun Pro** — $49/mo. Best streaming catalog, modern UI.
- **OpenKJ** — Free open-source, $10/mo songbook.

## Status
- **Phase:** Product vision defined — ready for design/development
- **Next:** Define MVP scope, wireframes, tech choices

## Decisions
- Multi-platform: iPad (KJ), Phone/PWA (Singers), Laptop (Playback Engine)
- Real-time sync via WebSockets (cloud + LAN fallback)
- SaaS pricing: Starter (Free) / KJ Pro $24.99/mo / KJ Pro+ $34.99/mo
- **No Venue tier** — KJs bring everything, venues don't buy tech (insight from Jon's KJ friend)
- KJ controls everything: ad space, VIP fast pass, battle mode, analytics exports
- Tipping: 95% to KJ, 5% to Joanie (covers processing)
- Launch pricing: 50% off first 6 months, lifetime lock for early adopters
- New features added: applause meter, duet matching, lifeline button, crowd mood detector, show templates, singer blacklist/notes, photo mode, between-singer ad space (KJ-owned), share clip to social, leaderboards, venue following
- QR code ecosystem for singer onboarding (no app install)
- AI-powered smart rotation, key suggestion, break music
- SwiftUI for iPad app, React PWA for singer app

## Links & Resources
- Competitive research: `JoanieKaraoke/karaoke-dj-app-research.md`
- Product vision: `JoanieKaraoke/PRODUCT-VISION.md`