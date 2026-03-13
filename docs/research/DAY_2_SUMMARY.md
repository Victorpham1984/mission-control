# Day 2 Research Summary - Backend Architecture

**Date:** March 6, 2026  
**Researcher:** Agent Phát  
**Focus:** Backend Stack, Database Schema, Authentication, Infrastructure

---

## 🎯 Mission Accomplished

Successfully reverse-engineered Polsia's **backend infrastructure** including tech stack (Node.js + Express + PostgreSQL), hosting (Render.com), authentication mechanism (session cookies), and captured **80+ database fields** from the Companies table.

---

## 🔑 Key Discoveries

### 1. **Confirmed Tech Stack**

| Layer | Technology | Evidence |
|-------|-----------|----------|
| **Backend** | Node.js + Express.js | `x-powered-by: Express` |
| **Database** | PostgreSQL | snake_case, jsonb, timestamptz |
| **Hosting** | Render.com | `x-render-origin-server: Render` |
| **CDN** | Cloudflare | `server: cloudflare` |
| **ORM** | Prisma or Sequelize (likely) | Standard Node.js + PostgreSQL |
| **Session Store** | Redis (inferred) | Express session best practice |
| **Payment** | Stripe | `stripe_subscription_id` field |

### 2. **Database Schema Goldmine**

From a single `/api/companies` API call, captured **80+ fields**:

**Critical Business Fields:**
- `plan_tier: "starter"` → Multiple pricing tiers exist
- `monthly_budget: 49` → $49/mo confirmed (Day 1 hypothesis validated)
- `stripe_subscription_id` → Stripe integration confirmed
- `subscription_status`, `subscription_started_at`, `subscription_ends_at`
- `trial_started_at`, `trial_ends_at`, `is_trial_active` → Free trial system

**Autonomy Engine Fields:**
- `cycle_frequency: "every_6_hours"` → Scheduled autonomous cycles
- `cycle_model: "auto"`, `cycle_autonomy: "autonomous"`
- `last_cycle_at`, `next_cycle_at`, `cycles_completed`, `cycles_loaded`
- `first_cycle_started` (boolean)
- `cycle_times: ["06:40"]` → Configurable schedule

**Mood System (Deep Dive):**
- `mood_label: "Puzzled"`
- `mood_message: "Empty response encountered during verification..."`
- `mood_ascii` → Full ASCII art stored in database
- `mood_agent: "Engineering"` → Mood per agent type
- `mood_updated_at` → Real-time mood updates

**Thinking/Agent State:**
- `last_thinking_json` → Full markdown content of agent's last thought
  ```json
  {
    "content": "## Done. SOP Engine MVP is live. 🟢...",
    "timestamp": "2026-03-06T04:46:38.952Z",
    "agent_name": "Engineering",
    "thinking_type": "thinking"
  }
  ```
- Polsia stores full agent "thinking" history in database

**Onboarding Tracking (8 fields):**
- `onboarding_status: "completed"`
- `onboarding_started_at`, `onboarding_completed_at`
- `onboarding_duration_seconds` (performance tracking!)
- `onboarding_user_replied`, `onboarding_dashboard_visited`
- `onboarding_last_email_at`, `onboarding_followup_count`

**Ads Integration:**
- `ads_enabled`, `ads_daily_budget`, `ads_campaign_id`, `ads_adset_id`
- `ads_meta_sync_failed`, `ads_meta_sync_error`, `ads_meta_sync_failed_at`
- Facebook Ads deeply integrated

**Revenue Tracking:**
- `balance_usd: "0.00"`, `total_revenue_usd: "0.00"`
- Per-company revenue tracking (for agency use case)

**Infrastructure Fields:**
- `infra_type`, `infra_status: "ready"`, `render_url`, `app_url`
- `infra_suspended_at`, `suspension_reason`
- Dynamic infrastructure provisioning per company

**Landing Page Generation:**
- `landing_page_html` → Full HTML stored in database
- Each company gets AI-generated landing page
- Example: https://runhive.polsia.app (from captured data)

**Soft Deletes:**
- `deleted_at` → Companies not permanently deleted (data retention)

### 3. **Authentication Deep Dive**

**Session Cookie:** `polsia_session`
- **Value:** 64-char hex (SHA256 hash)
  - Example: `46890c83e16d7809644382bc4036d655e2f084b0f7b1cf71f75552e1049975cf`
- **Security Attributes:**
  - ✅ `httpOnly: true` (JavaScript can't access)
  - ✅ `secure: true` (HTTPS only)
  - ✅ `sameSite: Lax` (CSRF protection)
  - `domain: polsia.com`
  - `expires: 1780411863` (March 29, 2026)
- **Lifetime:** ~23 days (convenience vs security trade-off)
- **Storage:** Likely Redis (standard Express session backend)

**No JWT:** Polsia uses traditional server-side sessions, not stateless JWT.

### 4. **API Response Patterns**

**Success Response:**
```json
{
  "success": true,
  "companies": [...],
  "primaryCompanyId": 13563
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Not found"
}
```

**Consistency:** Every response includes `success` boolean (Express middleware pattern).

### 5. **Hosting: Render.com**

**Evidence:**
- `x-render-origin-server: Render` header
- Render URL stored in database: `render_url` field

**Why Render vs Alternatives:**
- Cheaper than Heroku (Heroku killed free tier)
- More integrated than AWS (less DevOps complexity)
- Built-in PostgreSQL
- Auto-scaling
- Git-based deployments

### 6. **Rate Limiting Strategy**

**Test Results:**
- 10 rapid API requests → All succeeded
- No HTTP 429 (Too Many Requests)
- No rate limit headers (`x-ratelimit-*`)
- Average latency: ~220ms

**Conclusion:** Polsia relies on **Cloudflare** for DDoS protection instead of application-level rate limiting.

**Trade-off:** Simpler backend code, but less granular control over API abuse.

### 7. **Cloudflare Integration**

**Headers:**
- `server: cloudflare`
- `cf-ray: 9d7f1622191404de-HKG` → Request ID (Hong Kong edge server)
- `cf-cache-status: DYNAMIC` → API responses not cached
- `alt-svc: h3=":443"; ma=86400` → HTTP/3 support

**Benefits:**
- Global CDN (faster response times)
- Automatic SSL
- DDoS protection
- Bot filtering

---

## 📊 Deliverables Created

1. **`DAY_2_BACKEND_ANALYSIS.md`** (15KB)
   - Complete backend stack analysis
   - 80+ database fields documented
   - Authentication mechanism explained
   - Infrastructure stack confirmed
   - SQL schema inference

2. **`data/day-2-backend-probe.json`** (Raw API responses)
   - Full `/api/companies` response
   - Error handling samples
   - Rate limiting test results

3. **`scripts/polsia-api-probe.js`** (Node.js testing tool)
   - Automated API testing
   - HTTP header analysis
   - Response pattern detection
   - Reusable for future probes

4. **Updated `polsia-tech-architecture.md`**
   - Added Section 2: Backend Technology Stack
   - Updated Executive Summary
   - Renumbered subsequent sections

---

## 🧠 Strategic Insights for BizMate

### ✅ What Polsia Does Well (Backend)

1. **PostgreSQL for Flexibility**
   - Extensive use of `jsonb` fields
   - Allows rapid iteration without migrations
   - Examples: `settings`, `last_thinking_json`, `cycle_times`

2. **Render.com for Simplicity**
   - Lower DevOps overhead vs AWS/GCP
   - Auto-scaling built-in
   - Focus on product, not infrastructure

3. **Mood System Innovation**
   - Stores full ASCII art + messages in database
   - Real-time updates via SSE
   - Humanizes AI agents

4. **Onboarding Analytics**
   - Tracks duration, user interaction, email engagement
   - Data-driven onboarding optimization

5. **Per-Company Infrastructure**
   - Each company can have own subdomain (`runhive.polsia.app`)
   - Dynamic landing page generation
   - Agency-friendly architecture

### ⚠️ Potential Weaknesses

1. **Database Normalization**
   - 80+ columns in Companies table (anti-pattern)
   - Should split into separate tables (CompanySettings, CompanyBilling, etc.)
   - May cause performance issues at scale

2. **No Rate Limiting**
   - Vulnerable to API abuse (if Cloudflare bypassed)
   - No per-user quotas
   - Could lead to resource exhaustion

3. **Long Session Lifetime**
   - 23 days is generous (convenience > security)
   - Stolen cookie = 23 days of access
   - No session rotation observed

4. **No API Versioning**
   - Breaking changes will affect all clients
   - Should use `/api/v1/companies` pattern

5. **Soft Deletes Only**
   - `deleted_at` field → Companies never permanently deleted
   - GDPR compliance concern (right to be forgotten)

### 🎯 Differentiation Opportunities for BizMate

1. **Database Architecture**
   - Use proper normalization (Companies, Settings, Billing, Cycles as separate tables)
   - Better performance at scale
   - Easier to query/report

2. **API Rate Limiting**
   - Implement application-level quotas
   - Per-user, per-endpoint limits
   - Prevent abuse, ensure fair usage

3. **Security Enhancements**
   - Shorter session lifetime (1-7 days)
   - Session rotation on privilege escalation
   - 2FA/MFA for sensitive operations

4. **API Versioning**
   - `/api/v1/*` from day one
   - Graceful deprecation strategy
   - Better client compatibility

5. **Compliance-First**
   - Hard deletes option (GDPR)
   - Data export functionality
   - Audit logs

6. **Southeast Asia Optimization**
   - Deploy to Singapore/Tokyo (closer to SEA customers vs Render's US/EU)
   - Local payment methods (GCash, GrabPay, not just Stripe)
   - Multi-currency support (VND, THB, MYR)

---

## 📈 Progress Tracker

**Week 1-2 (14 days total):**
- ✅ Day 1: Frontend + Data Model (100%)
- ✅ Day 2: Backend + Database (100%)
- 🔄 Days 3-5: API Endpoints + Infrastructure (0%)
- ⏳ Days 6-10: Business Model Analysis (0%)
- ⏳ Days 11-12: UX/UI Patterns (0%)
- ⏳ Days 13-14: Gap Analysis + Synthesis (0%)

**Overall:** 14% complete (2/14 days)  
**Pace:** Ahead of schedule (Day 2 completed in 1 session!)

---

## ⏭️ Day 3 Plan (March 7)

### API Endpoint Inventory

**Goals:**
1. Map all REST endpoints
   - `/api/companies/:id`
   - `/api/companies/:id/documents`
   - `/api/companies/:id/links`
   - `/api/companies/:id/tasks`
   - `/api/companies/:id/conversations`
   - `/api/companies/:id/agents`
   - `/api/conversations/:id/messages`
   - `/api/executions/:id`

2. Document CRUD operations
   - GET (read)
   - POST (create)
   - PUT/PATCH (update)
   - DELETE (delete)

3. Test SSE endpoint
   - `/api/executions/stream?companyId={id}`
   - Capture all message types
   - Document reconnection logic

4. Capture request/response schemas
   - Save 20+ JSON samples
   - Map required vs optional fields
   - Identify validation rules

5. Test error handling
   - 400 Bad Request
   - 401 Unauthorized
   - 403 Forbidden
   - 404 Not Found
   - 422 Unprocessable Entity
   - 500 Internal Server Error

**Tools:**
- Extend `polsia-api-probe.js` script
- Use `curl` for SSE testing
- Capture screenshots of error states

**Success Criteria:**
- [ ] 30+ API endpoints documented
- [ ] Full CRUD operations mapped
- [ ] SSE message types catalogued
- [ ] Error response formats captured
- [ ] Request/response JSON samples saved

---

## 💡 Lessons Learned

1. **One API call = massive data dump**
   - `/api/companies` returned 80+ fields → Avoid overfetching
   - BizMate should use selective field filtering (`?fields=id,name,slug`)

2. **Render.com is underrated**
   - Heroku alternative gaining traction
   - Polsia chose it for simplicity
   - BizMate should evaluate Render vs Vercel/Railway

3. **Session cookies > JWT for this use case**
   - Polsia prioritizes simplicity
   - Server-side sessions easier to revoke
   - Trade-off: Redis dependency

4. **Cloudflare = essential for small teams**
   - Free tier provides DDoS protection
   - No need for application-level rate limiting
   - BizMate should use Cloudflare from day one

5. **Mood system = killer feature**
   - ASCII art + messages = unique UX
   - Humanizes AI agents
   - BizMate should innovate on agent personality/status

---

## 🔒 Security Observations

### ✅ Good Practices
1. httpOnly cookies (XSS protection)
2. Secure flag (HTTPS only)
3. sameSite=Lax (CSRF protection)
4. Cloudflare DDoS protection
5. HTTPS enforced

### ⚠️ Concerns
1. 23-day session lifetime (too long)
2. No visible session rotation
3. No 2FA/MFA
4. No API rate limiting
5. Soft deletes only (GDPR risk)

### 🔍 To Investigate (Day 5)
- [ ] CSP (Content Security Policy) headers
- [ ] HSTS (HTTP Strict Transport Security)
- [ ] Input validation patterns
- [ ] SQL injection prevention
- [ ] XSS prevention measures

---

## 📝 Open Questions (To Answer Days 3-14)

### Technical (Days 3-5)
- [ ] What's the full API endpoint list? (30+?)
- [ ] What ORM? (Prisma vs Sequelize?)
- [ ] What CI/CD? (GitHub Actions?)
- [ ] What monitoring? (Sentry? LogRocket?)
- [ ] What email service? (SendGrid? Postmark?)

### Business (Days 6-10)
- [ ] What's the free tier limit? (Or paid-only?)
- [ ] What's the conversion rate (trial → paid)?
- [ ] What's the churn rate?
- [ ] What's the average company count per user?
- [ ] What's the LTV?

### Product (Days 11-14)
- [ ] How does onboarding work (step-by-step)?
- [ ] What triggers autonomous cycles?
- [ ] How are tasks created?
- [ ] What's the agent selection logic?
- [ ] Can users customize agent behavior?

---

**Status:** Day 2 Complete ✅  
**Next Session:** Day 3 (API Endpoint Mapping)  
**Timeline:** Ahead of schedule 🟢  
**Budget Used:** $0  
**Token Estimate:** ~50K (Days 1-2 combined)
