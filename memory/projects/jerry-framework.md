# Jerry Framework

An opinionated full-stack project generator for rapid prototyping → production web/mobile apps.

## Architecture
- **Monorepo**: Turborepo + pnpm workspaces
- **Web**: Next.js 15 (App Router, RSC, Server Actions)
- **Mobile**: Expo Router (React Native) — optional, added with `--mobile expo`
- **API**: tRPC for end-to-end type safety
- **DB**: Drizzle ORM + PostgreSQL
- **Auth**: Clerk (default), Auth.js, or none
- **Styling**: Tailwind CSS v4
- **Payments**: Stripe or LemonSqueezy (optional)
- **Email**: Resend or Postmark (optional)
- **Analytics**: PostHog (optional)
- **Deploy**: Vercel (default) or Cloudflare Workers

## CLI
```bash
npx jerry create my-project [options]
  --auth clerk|authjs|none       (default: clerk)
  --db drizzle|prisma|none       (default: drizzle)
  --payments stripe|lemonsqueezy|none  (default: none)
  --email resend|postmark|none   (default: none)
  --analytics posthog|none       (default: none)
  --mobile expo|none             (default: none)
  --deploy vercel|cloudflare|none (default: vercel)
```

## Files
- `/cli/jerry.js` — Interactive CLI generator with template variable substitution
- `/templates/base/` — Full project template
  - `apps/web/` — Next.js 15 app with App Router, auth, dashboard
  - `packages/ui/` — Shared component library (Button, Input, Card, Badge, Container)
  - `packages/api/` — tRPC router + types
  - `packages/db/` — Drizzle ORM + PostgreSQL schema
  - `infra/docker/` — Docker Compose for local Postgres + Redis

## Status
- [x] CLI generator
- [x] Base template (Next.js 15 + Turborepo monorepo)
- [x] Shared UI components
- [x] tRPC API layer
- [x] Drizzle ORM + PostgreSQL
- [x] Auth scaffolding (Clerk/Auth.js/none)
- [x] Docker Compose for local services
- [x] ESLint + Prettier + TypeScript strict
- [ ] Expo mobile template
- [ ] Stripe/LemonSqueezy integration templates
- [ ] Resend email templates
- [ ] CI/CD GitHub Actions
- [ ] Jerry AI integration (Jerry creates, deploys, maintains projects)