# BizMate Business OS — Product Requirements Document (PRD)

**Version:** 0.1 (Draft)
**Ngày tạo:** 2026-03-13
**Author:** [Điền tên]
**Status:** 🟡 Draft — chờ review từ Sếp Victor

---

## 1. Tổng quan sản phẩm

### 1.1 Vision Statement
<!-- Một câu mô tả BizMate Business OS sẽ là gì khi hoàn thiện -->
<!-- Ví dụ: "BizMate Business OS là nền tảng vận hành kinh doanh AI-first cho SME Đông Nam Á — nơi CEO quản lý mọi hoạt động qua AI agents mà không cần biết code." -->

### 1.2 Problem Statement
<!-- Vấn đề cụ thể mà target user đang gặp -->
<!-- Câu hỏi dẫn dắt:
- SME owner hiện tại quản lý vận hành bằng cách nào? (Excel? Zalo group? Thủ công?)
- Pain point lớn nhất là gì? (Tốn thời gian? Không scale? Thiếu data?)
- Họ đã thử giải pháp nào? Tại sao chưa thành công?
- Chi phí của việc KHÔNG giải quyết vấn đề này? (giờ/tuần, tiền mất, opportunity cost)
-->

### 1.3 Target User
<!-- Mô tả chi tiết persona chính -->
<!-- Câu hỏi dẫn dắt:
- Ai là người MUA? (CEO/Founder)
- Ai là người DÙNG hàng ngày? (Manager? Chính CEO?)
- Industry nào trước? (E-commerce? F&B? Service?)
- Company size? (1-10? 10-50? 50-200?)
- Tech literacy? (Dùng được Shopee seller center = baseline)
- Budget range? (500K-5M VNĐ/tháng)
-->

**Persona chính:**

| Field | Giá trị |
|-------|---------|
| Tên giả | |
| Vai trò | |
| Industry | |
| Company size | |
| Pain point hàng ngày | |
| Tool hiện tại | |
| Budget | |
| Tech skill | |

---

## 2. Core Features (MVP)

<!-- Liệt kê 5-7 features quan trọng nhất cho MVP -->
<!-- Mỗi feature cần: mô tả ngắn, user story, acceptance criteria -->
<!-- Câu hỏi dẫn dắt:
- Feature nào giải quyết pain point #1 của target user?
- Feature nào tạo "aha moment" trong 5 phút đầu?
- Feature nào khiến user PHẢI quay lại ngày hôm sau?
-->

### Feature 1: [Tên feature]
- **User story:** Là [persona], tôi muốn [action], để [benefit].
- **Mô tả:**
- **Acceptance criteria:**
  - [ ]
  - [ ]

### Feature 2: [Tên feature]
- **User story:**
- **Mô tả:**
- **Acceptance criteria:**
  - [ ]

### Feature 3: [Tên feature]
- **User story:**
- **Mô tả:**
- **Acceptance criteria:**
  - [ ]

### Feature 4: [Tên feature]
- **User story:**
- **Mô tả:**
- **Acceptance criteria:**
  - [ ]

### Feature 5: [Tên feature]
- **User story:**
- **Mô tả:**
- **Acceptance criteria:**
  - [ ]

---

## 3. Anti-scope (KHÔNG build trong MVP)

<!-- Quan trọng không kém features — chốt rõ cái gì CHƯA làm -->
<!-- Câu hỏi dẫn dắt:
- Feature nào hấp dẫn nhưng chưa cần cho 100 users đầu?
- Cái gì thuộc Phase 2/3?
- Cái gì competitors có nhưng mình không cần copy?
-->

| Không build | Lý do | Khi nào reconsider |
|-------------|-------|-------------------|
| | | |
| | | |
| | | |

---

## 4. Success Metrics

<!-- KPIs đo lường thành công của MVP -->
<!-- Câu hỏi dẫn dắt:
- Metric nào chứng minh product-market fit?
- Metric nào Sếp Victor cần report cho investors/partners?
- North star metric là gì? (1 con số duy nhất)
-->

### North Star Metric
<!-- Ví dụ: Monthly Active Workflows (số workflow chạy thành công/tháng) -->

### Launch Metrics (30 ngày đầu)

| Metric | Target | Cách đo |
|--------|--------|---------|
| Signups | | |
| Activation rate (hoàn thành onboarding) | | |
| First task completed | | |
| Day-7 retention | | |
| Paid conversion | | |

### Growth Metrics (90 ngày)

| Metric | Target | Cách đo |
|--------|--------|---------|
| MRR | | |
| Monthly active users | | |
| Tasks completed/month | | |
| NPS | | |

---

## 5. User Experience

### 5.1 Onboarding Flow
<!-- Mô tả từng bước từ lần đầu vào app đến "aha moment" -->
<!-- Target: < 5 phút từ signup → first value -->

| Bước | Màn hình | User action | System response |
|------|----------|-------------|-----------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

### 5.2 Core Loop
<!-- Hành động user lặp lại hàng ngày — đây là cái giữ retention -->
<!-- Ví dụ: CEO mở app → xem KPIs → review task results → approve/adjust → close -->

### 5.3 Key Screens
<!-- Liệt kê 3-5 màn hình quan trọng nhất, mô tả content + layout -->

---

## 6. Technical Considerations

### 6.1 Tận dụng từ CommandMate
<!-- Những gì đã build có thể reuse trực tiếp -->
<!-- Ví dụ: auth flow, agent API, task pipeline, MCP infrastructure, Supabase setup -->

| Component | Reuse được? | Cần modify gì? |
|-----------|-------------|----------------|
| Auth (Supabase) | | |
| Agent API | | |
| Task pipeline | | |
| MCP infrastructure | | |
| Dashboard UI | | |

### 6.2 Schema mới cần thiết
<!-- Reference: docs/planning/bizmate/schema-design.md -->

### 6.3 Integration requirements
<!-- Shopee API, Lazada API, payment gateways, etc. -->
<!-- Câu hỏi: API access đã confirm chưa? Có sandbox? Rate limits? -->

---

## 7. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| | | | |
| | | | |
| | | | |

---

## 8. Timeline

<!-- High-level phases — chi tiết ở sprint-plan-v1.md -->

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| Design (Track B hiện tại) | Tuần 1-4 | PRD, schema, wireframes, pricing |
| MVP Development | Tuần 5-12 | Working product |
| Beta Launch | Tuần 13-16 | 50-100 beta users |
| Public Launch | Tuần 17+ | GA + marketing |

---

## 9. Open Questions

<!-- Câu hỏi cần Sếp Victor trả lời trước khi finalize PRD -->

1. [ ] Industry focus đầu tiên: e-commerce (Shopee) hay service business?
2. [ ] Onboarding: self-serve hay white-glove (tư vấn 1:1)?
3. [ ] Language: Vietnamese-only MVP hay bilingual?
4. [ ] Pricing: VNĐ hay USD? Local payment day 1 hay later?
5. [ ] Shopee API: đã có partnership/access chưa?
6. [ ]
7. [ ]

---

## Changelog

| Ngày | Version | Thay đổi |
|------|---------|----------|
| 2026-03-13 | 0.1 | Tạo template PRD, chờ điền nội dung |
| | | |
