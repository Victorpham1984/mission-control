# Nghiên cứu đối thủ: AgentOps vs Relevance AI vs CommandMate

> Ngày: 2026-02-20 | Tác giả: Đệ 🐾 (CEO) | Approved by: Sếp Victor

---

## 1. AgentOps

### Họ là ai?
**Developer platform** cho testing, debugging, và deploying AI agents. Open source.

### Tính năng chính
- **Observability**: Trace, visualize mọi LLM call, tool call, multi-agent interaction
- **Time Travel Debugging**: Rewind/replay agent runs chính xác từng thời điểm
- **Cost Tracking**: Theo dõi token usage, chi phí across 400+ LLMs
- **Fine-tuning**: Fine-tune LLM trên saved completions, tiết kiệm 25x
- **Integrations**: CrewAI, AutoGen, AG2, Agno, LangChain, Google ADK, Haystack...

### Pricing
| Plan | Giá | Giới hạn |
|------|-----|----------|
| Basic | **$0/mo** | 5,000 events |
| Pro | **$40/mo** | Unlimited events, pay-as-you-go |
| Enterprise | Custom | SLA, SSO, self-hosting, SOC-2/HIPAA |

### Target
**Developers / Engineers** — người code agents. Không phải business users.

---

## 2. Relevance AI

### Họ là ai?
**AI Workforce platform** — no-code, xây "nhân viên AI" cho business. Series A $10M (2024).

### Tính năng chính
- **AI BDR Agent**: Tự follow up leads, enrich data, book meetings 24/7
- **AI Research Agent**: Research trước mỗi sales call
- **Custom Agents**: No-code builder, drag & drop, describe → build
- **Workforce**: Combine nhiều agents thành team
- **2000+ Integrations**: Zapier, Salesforce, etc.
- **Calling & Meeting Agents**: Agents gọi điện, join meeting (Team plan)
- **A/B Testing & Evals**: Test agent performance

### Pricing
| Plan | Giá | Actions/mo |
|------|-----|-----------|
| Free | **$0** | 200 actions |
| Pro | **$29/mo** | 2,500 actions + $20 vendor credits |
| Team | **$349/mo** | 30,000 actions + $70 credits, 50 users |
| Enterprise | Custom | Unlimited |

### Target
**GTM teams (Sales, Marketing)** — non-technical business users. Focus mạnh vào Sales/BDR automation.

---

## 3. So sánh với CommandMate

| Tiêu chí | AgentOps | Relevance AI | CommandMate |
|----------|----------|-------------|-------------|
| **Target** | Developers | Sales/GTM teams | **SME Việt Nam (all teams)** |
| **Approach** | Monitoring/Debug | No-code AI workforce | **Agent Operations platform** |
| **Pricing model** | Events-based | Actions-based | **Outcome-based** |
| **Focus** | Observability | Sales automation | **Task management + approval** |
| **Agents** | External (CrewAI, etc.) | Built-in (no-code) | **External (OpenClaw, etc.)** |
| **Messaging** | None | Email, CRM | **Telegram-first** |
| **Knowledge** | None | Built-in RAG | **Shared Knowledge Layer (planned)** |
| **Data ownership** | Cloud | Cloud | **System of record (portability)** |
| **Giá khởi điểm** | $0 (5K events) | $0 (200 actions) | **$0 (100 outcomes)** |

---

## 4. Phân tích theo 3 trụ cột CommandMate

### Trụ 1: Outcome-based Pricing
- **AgentOps**: Tính theo events (mỗi LLM call = 1 event). Không liên quan output quality.
- **Relevance AI**: Tính theo actions (mỗi agent step = 1 action). Cũng không theo outcome.
- **CommandMate**: Tính theo **task completed + approved** → customer chỉ trả khi có kết quả thật.
- **🔥 Cơ hội**: Cả 2 đối thủ đều KHÔNG có outcome-based pricing. Đây là unique positioning.

### Trụ 2: Tools cho Agents
- **AgentOps**: Chỉ monitor, không cung cấp tools cho agents.
- **Relevance AI**: All-in-one — agents + tools đều built-in, closed ecosystem.
- **CommandMate**: Open platform — agents từ bất kỳ framework nào, dùng API để register, claim tasks, report.
- **🔥 Cơ hội**: CommandMate là "Switzerland" — neutral platform. Agents từ OpenClaw, CrewAI, LangChain... đều dùng được. Relevance lock-in users vào hệ sinh thái riêng.

### Trụ 3: System of Record
- **AgentOps**: Lưu logs/traces, nhưng data khó export. Developer tool.
- **Relevance AI**: Data trong platform. Export hạn chế.
- **CommandMate**: Full data ownership — export, audit trail, portability.
- **🔥 Cơ hội**: Compliance & trust. SME Việt Nam cần biết data ở đâu, ai access.

---

## 5. Đề xuất cụ thể cho CommandMate

### A. Học từ AgentOps
1. **Agent Replay/Debug**: Thêm tính năng "xem lại" agent đã làm gì trong mỗi task — Sếp click vào task completed, thấy từng bước agent thực hiện. → Phase 3+
2. **Cost tracking per task**: Hiện chi phí LLM/API cho mỗi task → Sếp biết ROI từng outcome.
3. **SDK approach**: Cung cấp lightweight SDK (Python/Node) để agents integrate nhanh, không chỉ REST API.

### B. Học từ Relevance AI
1. **Pre-built agent templates**: "AI BDR", "AI Content Writer", "AI Researcher" — user chọn template, deploy ngay. → Phase 2.
2. **Calling/Meeting agents**: Agents gọi điện, join Zoom. Quá sớm cho CommandMate nhưng note cho roadmap.
3. **A/B Testing**: Test 2 agents cùng task, so sánh output quality. → Phase 3.
4. **Marketplace**: Relevance có marketplace agents — CommandMate có thể tạo marketplace cho Vietnamese market.

### C. CommandMate Unique Advantages (giữ vững)
1. **Telegram-first** → Không đối thủ nào có. Đây là killer feature cho SME Việt Nam (100% dùng messaging).
2. **Outcome pricing** → Không ai có. Giữ đây là core differentiator.
3. **Vietnamese market** → AgentOps/Relevance AI target global/English. Không ai focus Việt Nam.
4. **Agent-agnostic** → Không lock-in. Agents từ bất kỳ đâu.

---

## 6. Kết luận

**CommandMate không cạnh tranh trực tiếp** với cả 2:
- AgentOps = dev tool (monitoring) → khác layer
- Relevance AI = no-code AI workforce → khác approach (closed vs open)

**CommandMate = Operations layer** — nằm giữa, quản lý output/approval/billing cho agents từ mọi nguồn.

**Positioning rõ ràng:**
> "AgentOps giúp debug agents. Relevance AI giúp build agents. CommandMate giúp **vận hành agents như nhân viên thật** — giao việc, theo dõi, duyệt, trả theo kết quả."
