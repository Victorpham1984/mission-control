# Polsia API Endpoints - Discovered via Network Analysis

**Date:** March 6, 2026 (Day 1)  
**Method:** Performance API, browser fetch monitoring

---

## Complete Endpoint List

### Authentication & Session
```
GET  /api/auth/session
POST /api/auth/check
GET  /api/auth/magic-link/{token}
```

### Companies
```
GET  /api/companies
GET  /api/companies/{id}
GET  /api/dashboard
POST /api/company/track-dashboard-visit
POST /api/company/track-activity
```

### Subscription & Billing
```
GET  /api/subscription
GET  /api/subscription/quantities
GET  /api/company-payments/{companyId}/balance
```

### Chat & Conversations
```
GET  /api/chat/conversations
GET  /api/chat/conversations?latest=true
GET  /api/chat/conversations/{id}/read
POST /api/chat/conversations/{id}/read
GET  /api/chat/proactive-greeting
```

### Tasks
```
GET  /api/tasks/recurring
```

### Ads Integration
```
GET  /api/companies/{companyId}/ads/status
GET  /api/companies/{companyId}/ads/list
```

### Outreach Integration
```
GET  /api/companies/{companyId}/outreach/status
GET  /api/companies/{companyId}/outreach/stats
```

### Twitter/Social Integration
```
GET  /api/companies/{companyId}/twitter/status
```

### Real-Time (SSE)
```
GET  /api/executions/stream?companyId={id}
```

### Analytics/Tracking
```
POST /api/track
```

---

## API Patterns Observed

### 1. RESTful Design
- Follows REST conventions (GET, POST, etc.)
- Resource-based URLs (`/companies`, `/tasks`, `/conversations`)
- Nested resources (`/companies/{id}/ads/status`)

### 2. Company-Scoped Endpoints
Most endpoints are scoped to company ID:
- `/api/companies/{companyId}/ads/...`
- `/api/companies/{companyId}/outreach/...`
- `/api/companies/{companyId}/twitter/...`

### 3. Status Pattern
Multiple "status" endpoints for integration states:
- `/ads/status`
- `/outreach/status`
- `/twitter/status`

Likely returns: `{ connected: boolean, account: string, ... }`

### 4. Analytics/Tracking
- Dashboard visit tracking
- Activity tracking
- Generic `/track` endpoint

### 5. Proactive Features
- `/chat/proactive-greeting` - Auto-generated chat messages
- `/tasks/recurring` - Recurring task system

---

## Inferred API Responses

### `/api/companies/{id}/ads/status`
```json
{
  "connected": true,
  "platform": "Facebook Ads",
  "account_id": "...",
  "last_sync": "2026-03-06T04:44:31.384Z"
}
```

### `/api/companies/{id}/outreach/stats`
```json
{
  "emails_sent": 150,
  "opens": 45,
  "replies": 12,
  "bounces": 3,
  "unsubscribes": 1
}
```

### `/api/subscription/quantities`
```json
{
  "company_slots": 1,
  "used_slots": 1,
  "available_slots": 0,
  "price_per_slot": 49.00
}
```

### `/api/company-payments/{id}/balance`
```json
{
  "balance": 0,
  "currency": "USD",
  "next_billing_date": "2026-04-01"
}
```

---

## Next Steps (Day 2)

1. **Capture Full Request/Response:**
   - Intercept fetch calls with monkey-patching
   - Log headers (Authorization, Content-Type)
   - Sample JSON payloads

2. **Authentication Mechanism:**
   - Check for JWT tokens
   - Inspect session cookies
   - Identify auth flow (OAuth, magic link, etc.)

3. **Rate Limiting:**
   - Test repeated requests
   - Check for `X-RateLimit-*` headers

4. **Error Responses:**
   - Trigger 400/404/500 errors
   - Document error format
