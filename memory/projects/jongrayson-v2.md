# Jon Grayson (jongrayson.com) - V2 Rebuild

**Goal:** Rebuild the static portfolio site using modern React, Tailwind, and shadcn/ui, compiled to static files for DreamHost SFTP deployment.
**Repo:** jgray4567/jongrayson

## Tech Stack
- Framework: Vite + React (or Next.js Static Export)
- Styling: Tailwind CSS
- UI Library: shadcn/ui
- Icons: Lucide React
- Deployment: GitHub Actions -> SFTP to DreamHost

## Design & UX
- **App Shell Architecture:** Unified layout where the sidebar and breadcrumb header stay anchored while the center content swaps out (feels like a secure web app, not disjointed pages).
- **Color Palette:** Retain the current brand palette but invert/convert it to a strict **Dark Mode** default.
- **Aesthetic Direction:** "FUSION / Project 941" Tactical Sci-Fi UI. 
  - Deep black/slate backgrounds with high-contrast glowing accents (neon blue, amber, cyan).
  - Technical typography (Monospace fonts for data/navigation, like `JetBrains Mono` or `Share Tech Mono`).
  - Geometric, chamfered edge borders (`clip-path` cuts instead of standard rounded corners).
  - Dense, data-heavy grid backgrounds and HUD-style graphical overlays.
- **Intel Navigation:** 
  - Collapsible tech/ops sidebar with tactical iconography.
  - Command Palette (`Cmd+K`) for instant jumping (frosted glass terminal look).
  - Breadcrumb trails (e.g., `JON GRAYSON / INTEL / CRIME MAP`).

## Phases
1. **Bootstrap:** Initialize Vite/React, Tailwind, shadcn CLI.
2. **Layout & Nav:** Build the shell and the new "Intel" tech navigation.
3. **Migration:** Port the globe, maps, and AI playbook into React components.
4. **Deploy:** Configure the build pipeline for static export.
## Reference UI Elements (Ignat Berbeci FUI)
To emulate the Ignat Berbeci Sci-Fi UI concepts in React/Tailwind:
1. **Radar/Gauges:** Use Recharts or custom SVG circles with `stroke-dasharray` to build animated radial readouts.
2. **Typography:** Use strict Monospace for all numeric data and metadata (e.g. `font-mono text-xs tracking-widest text-cyan-400`).
3. **Containers:** Build a custom `<FuiCard>` component that uses CSS `clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)` to give every panel chamfered, mechanical corners.
4. **Borders:** Thin, glowing borders (`border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]`).

## Target Audience & Positioning
- **Client Class Target:** High-end, sophisticated, security/tech/ops focused.
- **The Vibe:** "Next Level Tactical Tech." It must look and function like a live intelligence dashboard. It cannot look like a standard marketing site.

## Data Integrity (No Fake Jibberish)
- The FUI (Fictional UI) aesthetic will be used, but the data must be **real**.
- Avoid standard Sci-Fi placeholder text (no fake hex codes or random numbers).
- Use live or actual structured data (e.g., active crime stat readouts, real coordinates for the globe, actual AI server metrics from the Jerry API).

## Deployment Pipeline
- **Staging Environment:** Use the `jk-webteam-vps` (or a dedicated DreamHost staging folder like `v2.jongrayson.com`) to host a live staging URL.
- **Production:** `jongrayson.com`
- All changes must be pushed to staging and approved by Jon before compiling and deploying to production.

## Interactivity & Motion (Video Game Feel)
- **Library:** Framer Motion (for physics-based, fluid animations).
- **Core Directives:**
  1. The site must feel HIGHLY interactive. Every click, hover, and transition should provide immediate, satisfying feedback.
  2. Transitions between views (e.g. Map -> Globe) should feel like a camera panning or a HUD reconfiguring, not a standard webpage reload.
  3. *Note: Sound design is currently on hold. Focus entirely on visual and physics-based feedback first.*

## Engineering Standards & Output Quality
- **Best Practices:** The final static export must reflect elite frontend engineering standards.
- **Minification & Bundling:** All JS and CSS must be properly chunked, minified, and output to designated `assets/js/` and `assets/css/` directories.
- **Clean HTML:** The generated HTML must be semantic and clean, without massive inline `<script>` blocks or scattered, unorganized CSS.
- **Source Code (React):** The React component structure must be strictly organized (e.g., separating UI primitives from complex container components, using proper TypeScript interfaces).
- **The Goal:** If a senior engineer opens the DevTools and inspects the network payload or DOM, the site must look professionally compiled, modular, and performant—not like a messy AI hallucination.
