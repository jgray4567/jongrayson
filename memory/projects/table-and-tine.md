# Table & Tine — Recipe App

**Category:** Application

**Status:** Active
**Type:** Mobile App (iOS) + AI Backend
**Main URL:** https://tableandtine.com
**App Store:** Table & Tine (iOS)
**GitHub:** `jgray4567/table-and-tine` (app), `jgray4567/jerry-openmythos` (AI server)
**Domain:** tableandtine.com

## Overview
Table & Tine (formerly Gathered Table) is an AI-powered recipe app for iOS. Uses a custom OpenMythos Recurrent-Depth Transformer (Jerry server) for recipe extraction, dietary reasoning, and content moderation. Variable compute per request — easy tasks exit early, hard tasks get more loops.

## Tech Stack
- **iOS App:** Swift/SwiftUI, Expo-free native
- **AI Server:** Jerry (OpenMythos RDT on Mac Studio M4 Max 128GB)
  - Mythos-3B model with 64 MoE experts (4 active per token)
  - SmolLM3 135M router for request classification
  - MLX runtime on Apple Silicon
- **Backend:** RecipeExtractionService.swift → Jerry API
- **Infrastructure:** Redis caching, App Store Connect Offer Codes for memberships

## Key Features
- Recipe URL extraction (2-4 loops, <2s)
- Dietary adaptation (Celiac + Diabetic + Egg-Free, 8-16 loops, <5s)
- Content moderation (community recipe review, 4-8 loops, <3s)
- Recipe reformatting/normalization (2-4 loops, <1s)

## Architecture Docs
- `jerry-openmythos-architecture.md` — Full production architecture
- `jerry-architecture.md` — Model team and routing philosophy
- `jerry-infrastructure.md` — Infrastructure and redundancy plan
- `jerry-framework.md` — Build framework details
- `jerry-hardware.md` — Mac Studio hardware specs

## Deployment
- iOS app via App Store Connect / TestFlight
- AI server runs on Jon's Mac Studio (local inference)
- Domain: tableandtine.com

## Related
- Jerry AI project (`jerry-ai.md`)
- Frankenstein AI (`frankenstein-ai.md`)
- Part of JK Web Team client portfolio