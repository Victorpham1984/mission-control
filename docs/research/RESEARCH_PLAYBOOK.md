# Polsia Research Playbook - Agent Phát

**Purpose:** Step-by-step execution plan for when dashboard access is obtained  
**Status:** Ready to execute  
**Duration:** 14 days (2 weeks)

---

## Pre-Flight Checklist

Before starting dashboard exploration:

- [ ] Polsia credentials saved in `state/polsia-auth.json`
- [ ] Browser automation working (Chrome extension connected)
- [ ] Screenshot folder ready: `research/screenshots/`
- [ ] Data folder ready: `research/data/`
- [ ] Daily log template ready: `shared/DAILY_LOG.md`
- [ ] All 4 research documents initialized

---

## Week 1: Technical & Business Deep-Dive

### Day 1: Initial Reconnaissance (March 6-7)

**Duration:** 4 hours

**Objectives:**
1. Login and verify access
2. Initial dashboard tour
3. Feature inventory (high-level)
4. Tech stack detection

**Tasks:**
```markdown
[ ] Login to Polsia dashboard
[ ] Capture homepage/dashboard screenshot
[ ] Open browser DevTools (Network tab)
[ ] Navigate through all main sections
[ ] List all menu items / navigation structure
[ ] Take screenshot of each main section
[ ] Export Network HAR file (API calls)
[ ] Run Wappalyzer/BuiltWith detection
[ ] Document initial observations

**Screenshots to capture:**
- dashboard-overview.png
- navigation-menu.png
- (each major section)

**Data to collect:**
- navigation-structure.json
- network-har.json
- tech-stack-initial.txt
```

**Deliverables:**
- Update `polsia-tech-architecture.md` with initial findings
- Screenshot inventory (10-15 images)
- Tech stack preliminary list

---

### Day 2: Tech Stack Deep-Dive (March 7-8)

**Duration:** 6 hours

**Objectives:**
1. Analyze frontend framework
2. Map API structure
3. Detect third-party services
4. Database schema inference

**Tasks:**
```markdown
[ ] Inspect page source for framework clues
[ ] Check JavaScript bundle names (main.js, vendors.js)
[ ] Analyze API request/response patterns
[ ] Capture sample API responses (5-10 endpoints)
[ ] List all API endpoints discovered
[ ] Document authentication mechanism
[ ] Identify third-party scripts (analytics, monitoring, etc.)
[ ] Infer database relationships from API responses

**Files to create:**
- api-endpoints.md (comprehensive list)
- api-samples/*.json (example responses)
- tech-stack.md (detailed analysis)
```

**Tools:**
- Browser DevTools (Network, Sources, Console)
- Wappalyzer browser extension
- curl/Postman (API testing)

**Deliverables:**
- Complete tech stack documentation
- API endpoint map (20+ endpoints)
- Sample JSON responses

---

### Day 3: Data Model Mapping (March 8-9)

**Duration:** 6 hours

**Objectives:**
1. Identify all entities (Leads, Campaigns, etc.)
2. Map relationships
3. Create ERD diagram
4. Document key fields

**Tasks:**
```markdown
[ ] List all data entities from API responses
[ ] For each entity, document:
  - Key fields
  - Data types
  - Relationships (foreign keys)
  - Constraints (required, unique, etc.)
[ ] Create ERD using Mermaid syntax
[ ] Capture example records (anonymize if needed)
[ ] Document business logic in relationships

**Entities to map (examples):**
- Leads/Contacts
- Companies/Accounts
- Campaigns
- Email Sequences
- Tasks/Activities
- Workflows/Automations
- Users/Teams
- Tags/Segments
- Analytics/Events
```

**Deliverables:**
- ERD diagram (Mermaid)
- Entity documentation (10+ entities)
- Relationship matrix

---

### Day 4: Feature Deep-Dive (March 9-10)

**Duration:** 6 hours

**Objectives:**
1. Inventory all features
2. Test core workflows
3. Document user flows
4. Capture feature screenshots

**Tasks:**
```markdown
[ ] For each major feature area:
  [ ] Lead Management
  [ ] Email Automation
  [ ] Campaign Creation
  [ ] Workflow Builder
  [ ] Analytics/Reporting
  [ ] Integrations
  [ ] Settings/Admin

[ ] For each feature, document:
  - Purpose (what it does)
  - User flow (step-by-step)
  - API calls involved
  - UI components used
  - Edge cases / limitations

**User flow template:**
1. Entry point (where user starts)
2. Step 1: [action] → [result]
3. Step 2: [action] → [result]
4. ...
5. Completion state
```

**Deliverables:**
- Feature inventory (comprehensive list)
- User flow diagrams (5-10 major flows)
- Feature screenshots (30+ images)

---

### Day 5: Tech Architecture Synthesis (March 10-11)

**Duration:** 4 hours

**Objectives:**
1. Complete tech architecture document
2. Create system diagram
3. Document deployment architecture
4. Finalize findings

**Tasks:**
```markdown
[ ] Synthesize all technical findings
[ ] Create architecture diagram (Mermaid)
[ ] Document infrastructure setup
[ ] Assess scalability patterns
[ ] Identify potential tech debt
[ ] Compare to industry standards

**Architecture diagram should show:**
- Frontend (framework, routing, state management)
- Backend (API, services, business logic)
- Database (schema, relationships)
- Third-party services (integrations)
- Deployment (hosting, CDN, regions)
```

**Deliverables:**
- ✅ Complete `polsia-tech-architecture.md`
- Architecture diagram
- Tech assessment summary

---

### Day 6: Pricing Research (March 11-12)

**Duration:** 3 hours

**Objectives:**
1. Document all pricing tiers
2. Feature comparison by tier
3. Competitive pricing analysis

**Tasks:**
```markdown
[ ] Capture pricing page (screenshot + text)
[ ] Document each tier:
  - Name
  - Price (monthly/annual)
  - Features included
  - Limitations
  - Target customer
[ ] Calculate value per feature
[ ] Compare to competitors (HubSpot, Pipedrive, etc.)
[ ] Identify pricing strategy (value-based, cost-plus, etc.)

**Pricing matrix template:**
| Tier | Price/mo | Price/yr | Features | Limits | Target |
|------|----------|----------|----------|--------|--------|
```

**Deliverables:**
- Pricing breakdown table
- Competitor pricing comparison
- Pricing strategy analysis

---

### Day 7: GTM & Market Research (March 12-13)

**Duration:** 4 hours

**Objectives:**
1. Analyze go-to-market strategy
2. Customer acquisition channels
3. Onboarding flow analysis

**Tasks:**
```markdown
[ ] Onboarding flow walkthrough:
  [ ] Signup process (fields, steps)
  [ ] Email verification
  [ ] Account setup
  [ ] First-time user experience
  [ ] Activation milestones
  [ ] Screenshot each step

[ ] Marketing channels analysis:
  [ ] Website SEO (meta, keywords)
  [ ] Content marketing (blog, resources)
  [ ] Social media presence
  [ ] Paid advertising (Google Ads, Facebook)
  [ ] Partnerships/integrations
  [ ] Community (forum, Slack, etc.)

[ ] Customer acquisition:
  [ ] Free trial (length, features)
  [ ] Lead magnets (ebooks, templates)
  [ ] Sales process (self-service, sales-assisted)
  [ ] Conversion funnel
```

**Deliverables:**
- Onboarding flow documentation
- GTM channel analysis
- Customer acquisition strategy summary

---

### Day 8: Competitive Analysis (March 13-14)

**Duration:** 5 hours

**Objectives:**
1. Deep competitor comparison
2. Market positioning analysis
3. Customer review mining

**Tasks:**
```markdown
[ ] Competitor feature matrix:
  - HubSpot
  - Pipedrive
  - ActiveCampaign
  - Close
  - Salesforce

[ ] Review analysis (G2, Capterra, TrustRadius):
  [ ] Polsia reviews (read 20-30)
  [ ] Competitor reviews (sample 10 each)
  [ ] Identify common praise themes
  [ ] Identify common complaints
  [ ] Extract feature requests

[ ] Market positioning:
  [ ] Polsia's unique value prop
  [ ] Competitor value props
  [ ] Market gaps (unserved needs)
```

**Deliverables:**
- Competitive comparison matrix
- Review sentiment analysis
- Market gap identification

---

### Day 9: Business Model Canvas (March 14-15)

**Duration:** 3 hours

**Objectives:**
1. Complete business model documentation
2. Unit economics estimation
3. Revenue model analysis

**Tasks:**
```markdown
[ ] Business Model Canvas:
  [ ] Key Partnerships
  [ ] Key Activities
  [ ] Key Resources
  [ ] Value Propositions
  [ ] Customer Relationships
  [ ] Channels
  [ ] Customer Segments
  [ ] Cost Structure
  [ ] Revenue Streams

[ ] Unit economics (estimates):
  [ ] CAC (Customer Acquisition Cost)
  [ ] LTV (Lifetime Value)
  [ ] LTV:CAC ratio
  [ ] Churn rate (from reviews/public data)
  [ ] Payback period
```

**Deliverables:**
- ✅ Complete `polsia-business-model.md`
- Business model canvas
- Unit economics estimates

---

### Day 10: Business Analysis Buffer (March 15-16)

**Duration:** 3 hours

**Objectives:**
1. Fill any business model gaps
2. Deep-dive into interesting areas
3. Quality assurance

**Tasks:**
```markdown
[ ] Review business model doc for completeness
[ ] Deep-dive areas needing more research
[ ] Cross-check findings across sources
[ ] Update with any missed insights
```

---

## Week 2: UX/UI & Synthesis

### Day 11: UX/UI Systematic Analysis (March 16-17)

**Duration:** 6 hours

**Objectives:**
1. Design system extraction
2. Component library documentation
3. Interaction patterns

**Tasks:**
```markdown
[ ] Visual design analysis:
  [ ] Color palette (extract hex codes)
  [ ] Typography (fonts, sizes, weights)
  [ ] Spacing system (margin, padding patterns)
  [ ] Grid system (columns, breakpoints)
  [ ] Icon library (identify, document)

[ ] Component inventory:
  [ ] Buttons (all variants)
  [ ] Forms (inputs, selects, checkboxes, etc.)
  [ ] Tables (data grid patterns)
  [ ] Cards
  [ ] Modals/Dialogs
  [ ] Dropdowns/Menus
  [ ] Navigation components
  [ ] Charts/Data viz
  [ ] Loading states
  [ ] Empty states
  [ ] Error states

[ ] Interaction patterns:
  [ ] Hover effects
  [ ] Click feedback
  [ ] Loading animations
  [ ] Transitions (timing, easing)
  [ ] Micro-interactions
```

**Deliverables:**
- Design system documentation
- Component library inventory (30+ components)
- UI pattern screenshots (40+ images)

---

### Day 12: User Flow & Accessibility (March 17-18)

**Duration:** 6 hours

**Objectives:**
1. Document key user flows
2. Accessibility audit
3. Mobile responsiveness check

**Tasks:**
```markdown
[ ] User flow diagrams:
  [ ] Onboarding (new user to activation)
  [ ] Create lead (add contact workflow)
  [ ] Create campaign (end-to-end)
  [ ] Setup automation (workflow builder)
  [ ] Generate report (analytics flow)

[ ] Accessibility audit:
  [ ] Keyboard navigation test
  [ ] Screen reader compatibility (basic check)
  [ ] Color contrast analysis (WCAG AA)
  [ ] ARIA labels inspection
  [ ] Focus indicators
  [ ] Accessibility score (Lighthouse)

[ ] Responsive design:
  [ ] Desktop view (1920px, 1440px, 1280px)
  [ ] Tablet view (768px, 1024px)
  [ ] Mobile view (375px, 414px)
  [ ] Screenshot each breakpoint
  [ ] Document responsive patterns
```

**Deliverables:**
- ✅ Complete `polsia-ux-patterns.md`
- User flow diagrams (5+ flows)
- Accessibility audit report
- Responsive design documentation

---

### Day 13: Gap Analysis & SWOT (March 18-19)

**Duration:** 5 hours

**Objectives:**
1. SWOT analysis
2. Feature gap identification
3. Competitive positioning

**Tasks:**
```markdown
[ ] SWOT Analysis:
  [ ] Strengths (what Polsia does well)
  [ ] Weaknesses (what they do poorly)
  [ ] Opportunities (market gaps)
  [ ] Threats (competitive risks)

[ ] Feature gap matrix:
  [ ] Critical gaps (must-haves missing)
  [ ] Nice-to-have gaps (differentiation)
  [ ] Over-engineered (unnecessary complexity)

[ ] Competitive positioning:
  [ ] Polsia's position in market
  [ ] BizMate positioning options (3-4 strategies)
  [ ] Differentiation recommendations
```

**Deliverables:**
- SWOT matrix
- Feature gap analysis
- Positioning recommendations

---

### Day 14: Synthesis & Final Report (March 19-20)

**Duration:** 6 hours

**Objectives:**
1. Complete gap analysis document
2. Create executive summary
3. Compile all deliverables
4. Final QA

**Tasks:**
```markdown
[ ] Complete gap analysis document
[ ] Write executive summary (1-2 pages)
[ ] Create recommendations deck:
  [ ] Key findings (top 10)
  [ ] Strategic recommendations (top 5)
  [ ] Feature prioritization (MoSCoW)
  [ ] Differentiation strategy
  [ ] Go-to-market suggestions

[ ] Quality assurance:
  [ ] Review all 4 documents
  [ ] Verify all screenshots linked
  [ ] Check all data accurate
  [ ] Proofread for clarity
  [ ] Ensure actionable insights

[ ] Deliverable packaging:
  [ ] All markdown files finalized
  [ ] Screenshots organized
  [ ] Data files saved
  [ ] README.md created
  [ ] Summary for Đệ prepared
```

**Deliverables:**
- ✅ Complete `polsia-gap-analysis.md`
- Executive summary document
- Final recommendations deck
- Complete research package

---

## Deliverables Summary

### Required Documents (4)
1. ✅ `research/polsia-tech-architecture.md` (Day 5)
2. ✅ `research/polsia-business-model.md` (Day 9)
3. ✅ `research/polsia-ux-patterns.md` (Day 12)
4. ✅ `research/polsia-gap-analysis.md` (Day 14)

### Supporting Materials
- `research/screenshots/` (50+ images)
- `research/data/api-samples/*.json` (10+ files)
- `research/data/pricing.csv`
- `research/data/competitor-matrix.csv`
- `research/diagrams/` (ERD, architecture, user flows)

### Executive Deliverable
- `POLSIA_RESEARCH_SUMMARY.md` (for Đệ → Sếp Victor)

---

## Daily Routine

**Every Day:**
1. Update `shared/DAILY_LOG.md` with progress
2. Commit research files to prevent data loss
3. Flag critical insights to Đệ immediately
4. Time-box tasks (don't over-research one area)

**End of Week 1:**
- Send Week 1 summary to Đệ
- Highlight key technical/business findings
- Flag any risks or surprises

**End of Week 2:**
- Send complete research package
- Present top recommendations
- Brief Đệ for Sếp Victor report

---

## Success Criteria (from Task Brief)

- [x] All 4 research docs completed
- [ ] At least 20 screenshots captured (target: 50+)
- [ ] ERD diagram with 10+ entities
- [ ] Competitive positioning clear & actionable
- [ ] Đệ can brief Sếp on "build vs buy vs differentiate"

---

## Tools & Resources

### Browser Tools
- Chrome DevTools (Network, Elements, Console)
- Wappalyzer extension (tech stack detection)
- ColorZilla (color picker)
- Lighthouse (performance/accessibility audit)

### Automation
- `browser` tool (OpenClaw)
- `agent-browser` skill (if available)

### Documentation
- Mermaid (diagrams)
- Markdown (all docs)
- Screenshots (PNG, compressed)

### Analysis
- CSV exports (data analysis)
- JSON pretty-print (API samples)

---

## Risk Mitigation

**If access lost mid-research:**
- Save session state immediately
- Export all captured data
- Document what's complete vs. incomplete
- Escalate to Đệ

**If research takes longer than expected:**
- Prioritize: Tech → Business → UX → Gaps
- Reduce depth on lower-priority areas
- Focus on actionable insights over exhaustive documentation

**If Polsia changes during research:**
- Document as-is state
- Note any changes observed
- Consider "before/after" if significant

---

**Ready to execute. Awaiting access credentials.**

*Agent Phát, Research Analyst - Business OS Project*
