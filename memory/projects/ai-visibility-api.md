# AI Visibility API

**Category:** AI
**Status:** Active

## Overview

Backend API that analyzes how businesses appear in AI search results (ChatGPT, Perplexity, Gemini). Generates visibility scores, competitor comparisons, and actionable recommendations. Powers the AI Visibility Report feature on GDP client sites.

## Architecture

```
ai-visibility-api/
  server.js           — Express API server (port 8795)
  queryEngine.js     — Core AI query pipeline (queries OpenAI, analyzes responses)
```

- Express.js API
- Queries multiple AI models for brand visibility
- Generates visibility scores and competitor comparisons
- Returns actionable recommendations

## Local

`ai-visibility-api/` in workspace.