# CommandMate (tên tạm) — SaaS Architecture

## Overview
- Owner: BizMate (Sếp Victor)
- Product: AI Agent Management Dashboard (SaaS)
- Target: OpenClaw users → expand to multi-platform
- Revenue target: $200K ARR Year 1
- Model: Monthly subscription ($19/$49/$99)
- Self-build: Sếp + Đệ (AI agents)

## Tech Stack
- Frontend: Next.js + TypeScript + Tailwind
- Backend: Next.js API Routes + Server Actions
- Database: Supabase (Postgres + Auth + Realtime)
- Hosting: Vercel
- Payments: Stripe
- Email: Resend
- Analytics: PostHog
- Background jobs: Inngest
- Monitoring: Sentry

## Phases
- Phase 0 (T1-2): MVP + Auth + Multi-tenant | 0-50 users
- Phase 1 (T3-4): Stripe + Analytics + PWA | 50-200 users
- Phase 2 (T5-8): Teams + API + Marketplace | 200-500 users  
- Phase 3 (T9-12): Multi-platform + AI + Enterprise | 500-1000+ users

## Repo
- github.com/Victorpham1984/mission-control
- Branch: dev (staging) → main (production)
- Production: mission-control-sable-three.vercel.app
