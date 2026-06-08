# InspectAI

## Overview
Compliance / inspection automation concept for Kevin at Virginia DHP.

## Current direction
- Browser-first self-service compliance portal.
- Facilities submit required information and photos directly.
- AI validates completeness and photo requirements.
- Kevin reviews remotely.
- Onsite inspections reserved for first-time, failed, or flagged cases.

## Known assumptions
- output should be PDF
- current source workflow starts from an Excel workbook / spreadsheet
- Kevin currently handles about 2 onsite inspections per day
- backlog is in the hundreds

## Important next step
- Kevin needs to provide the Excel workbook so schema extraction and prototyping can begin.

## Earlier planning notes
- Tech stack discussed: React, React Native, Node.js, PostgreSQL, AWS S3, GPT-4o Vision
- Possible orchestration approach discussed: Codex + Claude Code with Jarvis coordinating
