# Phase 2B: Agent Persona & Learning System

> **Problem:** Current system executes tasks with generic LLM. Agents have no personality, context, or memory.  
> **Solution:** Agent = Persona + Workspace Knowledge + Feedback Loop  
> **Value:** Agents learn your business over time → compound moat

---

## I. The Problem

### Current Flow
```
Task "Minh, write social post" 
  → Connector calls LLM with generic prompt
  → Output = vanilla Sonnet (no "Minh" personality)
  → Submit
```

### What's Missing
| Component | Current | Needed |
|-----------|---------|--------|
| Persona | ❌ None | ✅ Agent-specific system prompt |
| Knowledge | ❌ None | ✅ Brand guidelines, products, past work |
| Memory | ❌ Stateless | ✅ Learns from approve/reject feedback |
| Differentiation | ❌ All agents same | ✅ Minh ≠ Kiến ≠ Thép |

### Impact
- **No value over ChatGPT** — customer can just use ChatGPT themselves
- **No consistency** — every task like the first time
- **No moat** — competitors clone easily
- **Quality variance** — can't guarantee outcome quality for pricing

---

## II. Solution Architecture

### 1. Agent Profile Table

```sql
CREATE TABLE agent_profiles (
  agent_id UUID PRIMARY KEY REFERENCES agents(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  
  -- Core identity
  name TEXT NOT NULL,
  role TEXT,  -- 'Content Writer', 'Frontend Dev', 'QA Engineer'
  
  -- Persona (injected into system prompt)
  persona TEXT,  -- "You are Minh, a content strategist..."
  writing_style TEXT,  -- "Casual, GenZ, emoji-rich, 2-3 hashtags"
  expertise TEXT[],  -- ['social-media', 'vietnamese-market', 'beauty-brands']
  
  -- Workspace knowledge pointers
  knowledge_base_refs UUID[],  -- → workspace_documents.id[]
  
  -- Learning & memory
  memory_context TEXT[],  -- Recent learnings (max 10)
  top_examples UUID[],  -- task_queue.id[] of 5⭐ tasks
  
  -- Stats
  avg_approval_rating NUMERIC,
  total_tasks_completed INT DEFAULT 0,
  tasks_approved INT DEFAULT 0,
  tasks_rejected INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_profiles_workspace ON agent_profiles(workspace_id);
```

### 2. Workspace Documents Table

```sql
CREATE TABLE workspace_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  
  -- Document metadata
  type TEXT NOT NULL,  -- 'brand_guideline', 'product_catalog', 'style_guide', 'example_work'
  title TEXT NOT NULL,
  description TEXT,
  
  -- Content
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text/markdown',  -- 'text/markdown', 'application/json'
  
  -- Semantic search (optional Phase 2C)
  embeddings VECTOR(1536),  -- pgvector extension
  
  -- Metadata
  tags TEXT[],
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workspace_docs_workspace ON workspace_documents(workspace_id);
CREATE INDEX idx_workspace_docs_type ON workspace_documents(workspace_id, type);
-- Phase 2C: CREATE INDEX ON workspace_documents USING ivfflat (embeddings vector_cosine_ops);
```

### 3. Enhanced Task Execution Flow

```
1. Task created & assigned to agent_id
2. Connector polls task
3. Connector fetches agent_profile + workspace_documents
4. Build context-rich prompt:
   - Agent persona
   - Brand guidelines
   - 2 top-rated examples from this agent
   - Last 3 feedback learnings
   - Task description
5. Call LLM with enriched prompt
6. Submit output
7. On approval/rejection → update agent memory
```

---

## III. Implementation Plan

### Week 7: Core Agent Persona

**Backend (Thép ⚙️):**
- [ ] DB migration: `agent_profiles`, `workspace_documents`
- [ ] API: `POST /api/v1/workspaces/{id}/agents/{agentId}/profile` — update persona
- [ ] API: `GET /api/v1/workspaces/{id}/agents/{agentId}/profile` — fetch full context
- [ ] API: `POST /api/v1/workspaces/{id}/documents` — upload workspace doc
- [ ] API: `GET /api/v1/workspaces/{id}/documents` — list docs by type

**Connector (Phát 🚀):**
- [ ] Before execute: fetch agent profile + workspace docs
- [ ] Build enriched system prompt
- [ ] After submit: POST feedback learning (if approved 5⭐ or rejected)

**Frontend (Kiến 🏗️):**
- [ ] Agent Profile page: edit persona, writing style, expertise
- [ ] Workspace Docs page: upload brand guidelines, products
- [ ] Agent card: show stats (avg rating, tasks completed)

---

### Week 8: Memory & Feedback Loop

**Backend (Thép ⚙️):**
- [ ] Webhook: `task.approval_completed` → extract learning
- [ ] Service: `extractLearning(task, approval)` → add to agent.memory_context
- [ ] Service: `updateTopExamples(agent)` → keep top 5⭐ tasks
- [ ] API: `GET /api/v1/agents/{id}/learnings` — show recent learnings
- [ ] Cleanup job: trim memory_context to max 10 items

**Connector:**
- [ ] No changes (backend handles learning extraction)

**Frontend (Kiến 🏗️):**
- [ ] Agent profile: "Recent learnings" section
- [ ] Agent profile: "Top examples" section
- [ ] Task detail: show which learnings were applied

---

### Week 9 (Optional): Semantic Search

**Backend (Thép ⚙️):**
- [ ] Enable pgvector extension in Supabase
- [ ] Generate embeddings for workspace_documents (OpenAI text-embedding-3-small)
- [ ] API: semantic search endpoint
- [ ] Inject relevant docs into prompt based on task semantic similarity

**Defer to Phase 3** if timeline tight. Weeks 7-8 already deliver core value.

---

## IV. Prompt Engineering

### Base Prompt Template

```
You are {agent.name}, a {agent.role} in this workspace.

Your personality and style:
{agent.persona}
{agent.writing_style}

Workspace context:
{workspace.brand_guideline}

You have completed {agent.total_tasks_completed} tasks with an average rating of {agent.avg_approval_rating}⭐.

Here are examples of your best work (rated 5⭐):
{agent.top_examples[0].output}
{agent.top_examples[1].output}

Recent feedback and learnings:
{agent.memory_context[-3:]}

Now, complete this task:
Title: {task.title}
Description: {task.description}
Required skills: {task.required_skills}

Provide your output below. Stay true to your style and apply the learnings above.
```

**Token budget:** ~2,000 tokens context + 2,000 task/output = 4k total (well within Sonnet 200k)

---

## V. Value Proposition

### Before (Phase 2A)
- Generic LLM execution
- No differentiation
- Every task = cold start
- Quality varies

### After (Phase 2B)
- **Agents with personality** — Minh writes differently than Kiến
- **Workspace knowledge** — agents know your brand
- **Continuous learning** — improve from feedback
- **Compound value** — the more you use, the better they get

**Tagline:** *"Your AI agents don't just work—they learn your business."*

**Moat:** Workspace-specific knowledge + agent memory = switching cost

---

## VI. Success Metrics

| Metric | Target | How to measure |
|--------|--------|----------------|
| Approval rate | >80% | tasks_approved / total_tasks |
| Avg rating | >4.0⭐ | AVG(approval_rating) WHERE approved |
| Consistency | Improving | StdDev(rating) decreases over time |
| Learning adoption | >50% | % of tasks where memory_context applied |

---

## VII. Open Questions

1. **Persona authoring:** User writes it manually, or we provide templates?
   - **Proposal:** Provide 5 templates (Content Writer, Developer, QA, Designer, Analyst) + custom edit

2. **Learning extraction:** Manual (user tags learnings) or auto (LLM extracts from task+feedback)?
   - **Proposal:** Auto-extract on 5⭐ approval or rejection with comment. LLM prompt: "Extract 1 learning from this feedback..."

3. **Workspace docs:** File upload or inline text?
   - **Proposal:** Both. Inline editor for quick edits, file upload for long docs.

4. **Embeddings now or later?**
   - **Proposal:** Later (Phase 3). Weeks 7-8 use simple doc fetching by type.

---

## VIII. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Context too long (>4k tok) | LLM errors | Truncate oldest learnings, summarize docs |
| Learning quality poor | Agents don't improve | Human review of auto-extracted learnings (Phase 3) |
| Users don't upload docs | Agents stay generic | Onboarding wizard: "Upload brand guideline to get started" |
| Persona too complex to write | Low adoption | Provide templates + examples |

---

## IX. Next Steps

**Decision needed (Sếp):**
- Proceed with Phase 2B (Weeks 7-8-9)?
- Or defer to Phase 3, do Zalo integration first?

**If proceed:**
1. Minh 📋 writes detailed API spec for agent profiles + workspace docs
2. Thép ⚙️ builds backend (Week 7)
3. Phát 🚀 updates connector to use enriched context (Week 7)
4. Kiến 🏗️ builds frontend UI (Week 7-8)
5. Soi 🔍 tests E2E: create persona → upload doc → execute task → verify learning (Week 8)
