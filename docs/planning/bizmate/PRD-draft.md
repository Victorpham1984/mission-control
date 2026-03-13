# BizMate Business OS — Product Requirements Document (PRD)

**Version:** 0.1
**Ngày tạo:** 2026-03-13
**Cập nhật:** 2026-03-13
**Author:** Đệ (Claude Code) + Sếp Victor (review)
**Status:** 🟡 Draft — chờ review từ Sếp Victor

---

## 1. Problem — Vấn đề thực tế của SME Việt Nam

### 1.1 Bối cảnh thị trường

Việt Nam có **1 triệu seller trên Shopee**, hàng trăm ngàn trên Lazada và TikTok Shop. Đa số là SME (1-50 người), do chính CEO/founder vận hành hàng ngày.

### 1.2 Pain points cụ thể (quantifiable)

**Pain #1: Xử lý đơn hàng thủ công — 8-16 giờ/ngày**
- Seller Shopee trung bình xử lý 50-100 đơn/ngày
- Mỗi đơn tốn 5-10 phút (check đơn → confirm → đóng gói → cập nhật trạng thái → trả lời chat)
- 100 đơn × 8 phút = **13 giờ/ngày** chỉ riêng xử lý đơn
- CEO không còn thời gian cho chiến lược, marketing, phát triển sản phẩm

**Pain #2: Quản lý bằng Excel + Zalo group — không scale**
- 73% SME Việt Nam dùng Excel/Google Sheets để quản lý vận hành (theo khảo sát VCCI 2025)
- Không có dashboard tổng quan — CEO phải tự tổng hợp số liệu cuối ngày
- Zalo group cho team communication → tin nhắn trôi, không track được task
- Khi đơn tăng từ 50 → 200/ngày, hệ thống thủ công sụp đổ

**Pain #3: Công cụ hiện tại không phù hợp**
- Polsia (competitor global): **100% tiếng Anh**, không tích hợp Shopee/Lazada, chỉ nhận thẻ tín dụng (70% người Việt không có)
- Zapier/Make: Quá phức tạp cho CEO non-tech, giá cao ($49-99/tháng)
- Sapo/KiotViet: Chỉ quản lý kho + POS, không có AI automation
- **Gap:** Chưa có tool AI-first, tiếng Việt, tích hợp Shopee, giá phù hợp SME

**Pain #4: Chi phí cơ hội — mất 10-20 giờ/tuần**
- CEO dành 60-70% thời gian cho vận hành thay vì growth
- Opportunity cost: nếu dành 10 giờ/tuần cho marketing → tăng 20-30% doanh thu (ước tính)
- Seller bỏ lỡ flash sale, campaign vì quá tải đơn hàng thường

### 1.3 Tại sao bây giờ?

- Polsia đã chứng minh demand cho AI business tools ($0.98/task, có khách trả tiền)
- Thị trường SEA chưa có competitor trực tiếp (blue ocean)
- AI capabilities (LLM) đủ trưởng thành để xử lý tiếng Việt tốt
- Shopee/Lazada mở rộng Open Platform API → cơ hội tích hợp

---

## 2. Target User — ICP Segments

### 2.1 Ba phân khúc chính

| Segment | Mô tả | Quy mô | Revenue/tháng | Pain chính |
|---------|--------|--------|----------------|------------|
| **Creator** | Content creator, KOL bán hàng online | 1-3 người | 20-100 triệu VNĐ | Tạo content + bán hàng cùng lúc, không kịp |
| **SME** | Shop Shopee/Lazada, cửa hàng online | 5-20 người | 100-500 triệu VNĐ | Quá tải đơn, quản lý team bằng Zalo |
| **Agency** | Agency marketing, quản lý nhiều shop | 10-50 người | 500 triệu - 2 tỷ VNĐ | Multi-client, multi-platform, cần automation |

### 2.2 Persona chính — MVP focus: SME Segment

**Persona 1: Chị Hạnh — Shop Shopee seller**

| Field | Giá trị |
|-------|---------|
| Tên giả | Chị Hạnh, 32 tuổi |
| Vai trò | CEO/Founder, kiêm mọi thứ |
| Industry | E-commerce (thời trang nữ trên Shopee) |
| Company size | 8 người (3 đóng gói, 2 chat, 1 kho, 1 marketing, 1 kế toán) |
| Pain point hàng ngày | 80 đơn/ngày, tự tay check từng đơn trên Seller Center. Cuối ngày kiệt sức, không kịp lên content cho flash sale. Team chat qua Zalo, task bị quên thường xuyên |
| Tool hiện tại | Shopee Seller Center + Excel + Zalo group + sổ tay |
| Budget | 500K-2 triệu VNĐ/tháng (sẵn sàng trả nếu tiết kiệm 2+ giờ/ngày) |
| Tech skill | Dùng thành thạo Shopee Seller Center, Facebook. Không biết code. Dùng Canva cho hình ảnh |

**Persona 2: Anh Tuấn — Agency owner**

| Field | Giá trị |
|-------|---------|
| Tên giả | Anh Tuấn, 28 tuổi |
| Vai trò | Founder agency marketing |
| Industry | Digital marketing agency, quản lý 5-10 shop Shopee cho khách hàng |
| Company size | 15 người (5 content, 3 ads, 2 customer service, 3 operations, 2 management) |
| Pain point hàng ngày | Mỗi khách hàng = 1 Shopee shop = 1 set tasks riêng. Không có dashboard tổng hợp. Báo cáo khách hàng mỗi tuần tốn 3-4 giờ copy-paste từ nhiều nguồn |
| Tool hiện tại | Google Sheets (report), Trello (task), Shopee Seller Center × 10 tabs |
| Budget | 5-20 triệu VNĐ/tháng (per-client pricing) |
| Tech skill | Biết dùng API cơ bản, quen automation nhẹ (Zapier) |

---

## 3. User Stories

### Core Stories (MVP)

**US-1:** Là CEO shop Shopee, tôi muốn **xem tổng quan kinh doanh trên 1 dashboard**, để không phải mở 5 tab Excel và Shopee Seller Center mỗi sáng.

**US-2:** Là seller 80 đơn/ngày, tôi muốn **AI tự động xử lý đơn hàng mới** (confirm, gán shipper, cập nhật trạng thái), để tôi chỉ cần duyệt kết quả thay vì làm tay từng đơn.

**US-3:** Là chủ shop, tôi muốn **đặt mục tiêu doanh thu tháng và thấy tiến độ real-time**, để biết đang đi đúng hướng hay cần điều chỉnh chiến lược.

**US-4:** Là CEO non-tech, tôi muốn **cài đặt quy trình tự động (playbook) chỉ với 1-2 click**, để không cần hiểu code hay cấu hình phức tạp.

**US-5:** Là seller, tôi muốn **AI tự động trả lời chat khách hàng thường gặp** (giá, size, ship), để team chat tập trung vào case phức tạp.

**US-6:** Là agency owner, tôi muốn **1 workspace quản lý tất cả shop khách hàng**, để xem tổng hợp KPIs và tạo report nhanh cho từng khách.

**US-7:** Là CEO, tôi muốn **nhận báo cáo tóm tắt hàng ngày qua Telegram/Zalo**, để biết tình hình kinh doanh mà không cần mở app.

---

## 4. Core Features (MVP) — 5 Features chính

### Feature 1: CEO Dashboard (Bảng điều khiển)

- **User story:** US-1, US-3
- **Mô tả:** Dashboard 1 màn hình hiển thị: mục tiêu tháng + tiến độ, KPIs chính (đơn hàng, doanh thu, conversion), agents đang chạy, actions gần nhất. Mobile-first, load < 2 giây.
- **Success metrics:**
  - 80% users mở dashboard ít nhất 1 lần/ngày (DAU/MAU > 0.4)
  - Thời gian trung bình trên dashboard: > 2 phút (engaged, không bounce)
- **Acceptance criteria:**
  - [ ] Hiển thị goal progress bar (current_value / target_value)
  - [ ] Show 3-5 KPIs chính với trend arrows (tăng/giảm so với tuần trước)
  - [ ] List agents đang hoạt động + status
  - [ ] List 10 actions gần nhất với success/fail badge
  - [ ] Responsive: mobile 375px → desktop 1440px

### Feature 2: Goal & KPI Setting (Đặt mục tiêu)

- **User story:** US-3
- **Mô tả:** CEO đặt 1-3 mục tiêu kinh doanh (VD: "100 đơn/tháng", "50 triệu doanh thu"). Hệ thống tự động tạo KPIs liên quan và track real-time từ actions log. KPIs auto-update qua Postgres trigger khi action mới được log.
- **Success metrics:**
  - 90% users đặt ít nhất 1 goal trong onboarding
  - 60% users quay lại check goal progress trong 7 ngày đầu
- **Acceptance criteria:**
  - [ ] Chọn goal type từ preset list (doanh thu, đơn hàng, content, leads)
  - [ ] Nhập target value + unit + deadline
  - [ ] Auto-create KPIs tương ứng (source = 'calculated')
  - [ ] KPIs auto-update khi actions INSERT (trigger + materialized view mỗi 5 phút)
  - [ ] Hiển thị progress bar trên dashboard

### Feature 3: Playbook Marketplace (Cài đặt quy trình)

- **User story:** US-2, US-4
- **Mô tả:** Thư viện playbooks (workflow templates) pre-built cho từng industry. CEO browse → chọn → "Cài đặt ngay" → system spawn agents + schedule tasks. Aha moment: từ 0 → automation chạy trong < 2 phút.
- **Success metrics:**
  - 70% users cài ít nhất 1 playbook trong onboarding
  - Playbook "Shopee Auto-Order" là #1 installed (> 50% e-commerce users)
- **Acceptance criteria:**
  - [ ] Hiển thị playbooks filtered theo industry + goal từ onboarding
  - [ ] Highlight "Đề xuất cho bạn" dựa trên context
  - [ ] 1-click install: tạo `installed_playbooks` + spawn agents
  - [ ] Customization panel: override schedule, toggle steps on/off
  - [ ] Show playbook status: active/paused, last run, run count

### Feature 4: Actions Log (Nhật ký hoạt động)

- **User story:** US-2
- **Mô tả:** Mọi action agent thực hiện (xử lý đơn, gửi email, tạo content) được log với evidence (screenshot, link, metrics). CEO review kết quả, approve/reject. Đây là basis cho outcome-based billing và trust-building ("AI đã làm gì cho tôi hôm nay?").
- **Success metrics:**
  - 50+ actions/tuần per active company (chứng minh automation đang chạy)
  - 80% actions có success = true (quality threshold)
- **Acceptance criteria:**
  - [ ] Log mỗi action: type, description, success, evidence (JSONB), cost, duration
  - [ ] Filter theo: date range, action_type, success/fail, playbook
  - [ ] Evidence viewer: expand để xem screenshots, links, metrics
  - [ ] Export CSV cho báo cáo
  - [ ] Feed vào KPIs auto-update

### Feature 5: Onboarding Wizard (5 phút → first value)

- **User story:** US-1, US-4
- **Mô tả:** 6 bước: Signup → Company Profile → Đặt mục tiêu → Cài Playbook → Kết nối (optional) → Dashboard. Mỗi bước 1 màn hình, 1 action chính. Wireframe chi tiết: `docs/planning/bizmate/wireframe-onboarding.md`.
- **Success metrics:**
  - 70% users hoàn thành onboarding (bước 1 → bước 6)
  - Median time: < 5 phút
  - Drop-off rate: < 10% per step
- **Acceptance criteria:**
  - [ ] Progress bar "Bước X/5"
  - [ ] Company profile: card selector cho industry, radio cho team size
  - [ ] Goal setting: preset goals + number input
  - [ ] Playbook install: gợi ý dựa trên industry + goal
  - [ ] Skip-able bước 5 (Connect platforms)
  - [ ] Bước 6 hiển thị dashboard có data (agents sẵn sàng, goal đã set)

---

## 5. Anti-scope — KHÔNG build trong MVP

| Không build | Lý do | Khi nào reconsider |
|-------------|-------|-------------------|
| Multi-company per workspace | 1:1 đủ cho SME. Agency cần → Phase 4+ | Khi có 50+ agency users yêu cầu |
| Shopee/Lazada API integration thật | API access chưa confirm (Blocker 2). MVP dùng manual mode | Khi có API partnership hoặc sandbox |
| Payment/billing system | MVP miễn phí cho beta users. Revenue khi có PMF | Tháng 4-6 (Phase 2) |
| Multi-language (English, Thai, Indo) | Vietnamese-first, validate PMF trước | Tháng 7+ khi expand sang SEA |
| Mobile app (React Native) | Web responsive đủ cho MVP. Mobile khi DAU > 1K | Tháng 7+ |
| Custom agent builder | Pre-built playbooks đủ cho MVP. Custom = power user feature | Phase 3 khi có playbook marketplace |
| Real-time collaboration | CEO thường làm 1 mình. Team collab = enterprise feature | Khi có 20+ users request |
| AI chat interface (conversational) | Chat UI phức tạp, dashboard đủ cho v1 | Phase 2 nếu retention thấp |
| Inventory management | Sapo/KiotViet đã giải quyết tốt. Không compete | Chỉ khi tích hợp Shopee inventory API |

---

## 6. Success Metrics

### North Star Metric

**Monthly Successful Actions (MSA)** — Số actions thành công/tháng trên toàn hệ thống.

Tại sao MSA?
- Đo trực tiếp giá trị mà BizMate tạo ra cho users
- Correlate mạnh với retention (nhiều actions = nhiều value = ở lại)
- Basis cho outcome-based pricing sau này
- Dễ đo: `SELECT COUNT(*) FROM actions WHERE success = true AND created_at >= date_trunc('month', now())`

### Launch Metrics (30 ngày đầu)

| Metric | Target | Cách đo |
|--------|--------|---------|
| Signups | 100 | `profiles` count |
| Activation rate (hoàn thành onboarding) | 70% | `companies` / `profiles` |
| First playbook installed | 60% | `installed_playbooks` / `companies` |
| Day-7 retention | 40% | Users active ngày 7 / signups |
| MSA per company | 50+ | `actions WHERE success = true` / `companies` |

### Growth Metrics (90 ngày)

| Metric | Target | Cách đo |
|--------|--------|---------|
| MRR | $190 → $10K | Payment system (Phase 2) |
| Monthly active users | 300+ | Dashboard visits > 1/tuần |
| Total MSA | 5,000+ | `actions` aggregate |
| NPS | > 40 | In-app survey |
| Organic traffic | 5K visits/tháng | Google Analytics / SEO blog |

---

## 7. UX Principles — Nguyên tắc thiết kế

### 7.1 Mobile-first, thumb-friendly

CEO hay dùng điện thoại. Design cho 375px trước, desktop sau. Button size tối thiểu 44px. Không dùng hover-only interactions.

### 7.2 Tiếng Việt, giọng thân thiện

Toàn bộ UI bằng tiếng Việt. Không dùng thuật ngữ kỹ thuật (nói "quy trình tự động" thay vì "playbook automation"). Giọng văn như bạn bè tư vấn, không phải manual kỹ thuật.

### 7.3 Onboarding < 5 phút, aha moment < 2 phút

Từ signup → dashboard có data trong < 5 phút. Aha moment = thấy agents sẵn sàng chạy + goal đã set + playbook đã cài. Không bắt user config phức tạp.

### 7.4 Outcome-first, không process-first

Hiển thị KẾT QUẢ trước (bao nhiêu đơn đã xử lý, bao nhiêu tiền tiết kiệm), không hiển thị chi tiết process. CEO quan tâm "AI đã làm được gì?" chứ không phải "AI đang chạy step 3/7".

### 7.5 Progressive disclosure

Onboarding = simple choices (card selector, 1-click install). Settings nâng cao giấu trong panel riêng. Không overwhelm user với options ngay từ đầu.

---

## 8. Technical Considerations

### 8.1 Nguyên tắc: Giữ CommandMate intact

BizMate build ON TOP OF CommandMate. Không thay đổi existing tables. Bridge qua `workspace_id`.

### 8.2 Tận dụng từ CommandMate

| Component | Reuse được? | Cần modify gì? |
|-----------|-------------|----------------|
| Auth (Supabase) | ✅ 100% | Không — signup → profile → workspace → API key đã có |
| Agent API | ✅ 90% | Thêm spawn agents từ playbook config |
| Task pipeline | ✅ 80% | Thêm link task → action, playbook scheduling |
| MCP infrastructure | ✅ 100% | Không — dùng trực tiếp cho tool execution |
| Dashboard UI | ⚠️ 30% | Rebuild cho CEO perspective (hiện tại là developer-focused) |
| Notification system | ✅ 70% | Thêm daily summary report template |

### 8.3 Schema mới (7 tables)

Chi tiết: `docs/planning/bizmate/schema-design.md`

| Table | Mục đích | Phase |
|-------|---------|-------|
| `companies` | Business entity, 1:1 workspace | Phase 1 |
| `goals` | Business objectives | Phase 1 |
| `kpis` | Auto-tracked metrics | Phase 1 |
| `playbooks` | Workflow templates (global) | Phase 2 |
| `installed_playbooks` | Per-company instances | Phase 2 |
| `actions` | Operations log (billing basis) | Phase 2 |
| `integrations` | OAuth tokens (Shopee, Lazada) | Phase 3 |

### 8.4 Integration requirements

| Platform | API Status | Fallback |
|----------|------------|----------|
| Shopee Open Platform | ⚠️ Chưa confirm (Blocker 2) | Manual CSV upload |
| Lazada Open Platform | ❓ Chưa research | Manual mode |
| TikTok Shop | ❓ Chưa research | Phase 3+ |
| Momo/ZaloPay (billing) | ❓ Chưa research | Bank transfer + Stripe cho Phase 2 |

---

## 9. Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Shopee API không có access** (Blocker 2) | 40% | Cao | Fallback: manual CSV mode trước, API sau. Ref: `BLOCKERS.md` |
| **Playbook content chưa sẵn sàng** (Blocker 1) | 30% | Cao | Template đã tạo. Deadline: 2026-03-20. Fallback: generic task template |
| **User không hiểu "playbook" concept** | 25% | Trung bình | UX test với 5 target users trước launch. Dùng từ "quy trình tự động" |
| **CommandMate engine chưa production-ready** | 20% | Cao | Track A (70% effort) ship CommandMate v1 trước. BizMate chờ stable engine |
| **Polsia pivot sang SEA** | 10% | Trung bình | Content moat (40 bài SEO), community moat (Facebook group). 12 tháng head start |
| **Build chậm, miss market window** | 20% | Cao | Lean MVP (Phase 1 = dashboard + goals + KPIs). Ref: `sprint-plan-v1.md` |

Chi tiết blockers: `docs/planning/bizmate/BLOCKERS.md`

---

## 10. Go-to-Market — Pricing & Distribution

### 10.1 Pricing hypothesis (Freemium SaaS)

| Plan | Giá/tháng | Actions/tháng | Target |
|------|-----------|---------------|--------|
| **Free** | 0 | 10 actions | Trial — prove value trước |
| **Starter** | 399K VNĐ (~$19) | 100 actions | Solo seller, creator |
| **Pro** | 999K VNĐ (~$49) | 500 actions | Shop 5-20 người |
| **Agency** | Custom | Unlimited | Agency, multi-shop |

**So sánh Polsia:** $0.98/task × 500 = $490/tháng. BizMate Pro = $49/tháng → **rẻ hơn 90%** ở quy mô lớn.

**Thanh toán:** Momo, ZaloPay, chuyển khoản ngân hàng (ưu tiên). Stripe cho international users.

### 10.2 Distribution channels

| Channel | Strategy | Timeline | Expected output |
|---------|----------|----------|-----------------|
| **SEO** | 10 bài/tháng: "tự động hóa Shopee", "quản lý đơn Lazada" | Tháng 1-6 | 10K visits/tháng (tháng 6) |
| **Facebook Groups** | Join "Shopee Sellers Vietnam", chia sẻ tips + soft sell | Tháng 1+ | 1K group members (tháng 6) |
| **Facebook Ads** | $500/tháng Phase 1, $2K/tháng Phase 2 | Tháng 1+ | CAC $30-50 |
| **Product Hunt** | Launch day với Vietnamese community support | Tháng 3 | 200-500 signups |
| **Referral** | "Mời bạn → cả hai được 1 tháng Pro miễn phí" | Tháng 4+ | 20% users từ referral |
| **Shopee partnership** | Co-marketing nếu có API partnership | Tháng 7+ | Official partner badge |

### 10.3 Competitor positioning

```
                    Tiếng Việt
                        ▲
                        │
          BizMate ◆     │
          (AI + Shopee  │
           + VN)        │
                        │
  ──────────────────────┼──────────────────── Shopee-specific
  Sapo/KiotViet         │        Polsia
  (POS + Inventory,     │        (AI + generic,
   VN, no AI)           │         EN, no Shopee)
                        │
                        │     Zapier/Make
                        │     (automation,
                        │      EN, complex)
                        │
                    Tiếng Anh
```

**BizMate sweet spot:** AI-first + Shopee-native + Vietnamese → chưa ai chiếm vị trí này.

---

## 11. Timeline

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| Design (Track B hiện tại) | Tuần 1-4 | PRD, schema, wireframes, pricing |
| MVP Development | Tuần 5-12 | Dashboard + Goals + KPIs + Playbooks |
| Beta Launch | Tuần 13-16 | 50-100 beta users, collect feedback |
| Public Launch | Tuần 17+ | GA + SEO content + Facebook ads |

---

## 12. Open Questions — Chờ Sếp Victor

1. [ ] Industry focus đầu tiên: e-commerce (Shopee) hay service business?
2. [ ] Onboarding: self-serve hay white-glove (tư vấn 1:1)?
3. [ ] Language: Vietnamese-only MVP hay bilingual?
4. [ ] Pricing: VNĐ hay USD? Local payment day 1 hay later?
5. [ ] Shopee API: đã có partnership/access chưa? (Blocker 2)
6. [ ] Beta users: đã có list chưa? Recruit từ đâu?
7. [ ] Budget Phase 1: $13.5K đã approve chưa?

---

## Changelog

| Ngày | Version | Thay đổi |
|------|---------|----------|
| 2026-03-13 | 0.1 | Tạo template PRD, chờ điền nội dung |
| 2026-03-13 | 0.1 | Điền đầy đủ 10 sections: Problem, ICP, User Stories, Features, Anti-scope, Metrics, UX, Tech, Risks, GTM |
