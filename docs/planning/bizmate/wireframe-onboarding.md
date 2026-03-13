# BizMate Business OS — Wireframe Onboarding Wizard

**Version:** 0.1
**Ngày:** 2026-03-17
**Target:** CEO/Owner SME Việt Nam, non-tech
**Goal:** Signup → first value trong < 5 phút

---

## Tổng quan Flow

```
[Signup] → [Company Profile] → [Chọn Mục tiêu] → [Cài Playbook] → [Kết nối (optional)] → [Dashboard]
   1            2                    3                  4                  5                   6
```

**Nguyên tắc:**
- Mỗi bước 1 màn hình, 1 action chính
- Có thể skip bước optional (bước 5)
- Progress bar hiển thị "Bước 2/6"
- Ngôn ngữ: tiếng Việt, giọng thân thiện, không dùng thuật ngữ kỹ thuật
- Mobile-first (CEO hay dùng điện thoại)

---

## Bước 1: Đăng ký (Signup)

```
┌─────────────────────────────────┐
│                                 │
│     🏢 BizMate Business OS     │
│                                 │
│   Quản lý kinh doanh thông     │
│   minh với AI                   │
│                                 │
│   ┌───────────────────────┐     │
│   │ Email                 │     │
│   └───────────────────────┘     │
│   ┌───────────────────────┐     │
│   │ Mật khẩu              │     │
│   └───────────────────────┘     │
│                                 │
│   [ Đăng ký miễn phí →   ]     │
│                                 │
│   ── hoặc ──                    │
│   [ Google ] [ Facebook ]       │
│                                 │
│   Đã có tài khoản? Đăng nhập   │
└─────────────────────────────────┘
```

**Action:** Submit form → tạo profile + workspace + company (auto)
**Validation:** Email format, password ≥ 8 chars
**Sau submit:** Redirect sang Bước 2

---

## Bước 2: Thông tin công ty (Company Profile)

```
┌─────────────────────────────────┐
│  Bước 1/5 ▓▓░░░░░░░░           │
│                                 │
│  👋 Chào mừng! Cho BizMate     │
│  biết về công ty bạn            │
│                                 │
│  Tên công ty                    │
│  ┌───────────────────────┐      │
│  │ VD: Shop Hạnh Phúc    │      │
│  └───────────────────────┘      │
│                                 │
│  Lĩnh vực kinh doanh           │
│  ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 🛒  │ │ ✍️  │ │ 🍜  │      │
│  │TMĐT │ │Nội  │ │F&B  │      │
│  │     │ │dung │ │     │      │
│  └─────┘ └─────┘ └─────┘      │
│  ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 🔧  │ │ 📊  │ │ ❓  │      │
│  │Dịch │ │B2B  │ │Khác │      │
│  │ vụ  │ │     │ │     │      │
│  └─────┘ └─────┘ └─────┘      │
│                                 │
│  Quy mô                        │
│  ( ) Chỉ mình tôi              │
│  ( ) 2-10 người                 │
│  ( ) 11-50 người                │
│  ( ) 50+ người                  │
│                                 │
│        [ Tiếp tục → ]          │
└─────────────────────────────────┘
```

**Action:** Chọn industry (card selector) + team size → save vào `companies`
**Default:** Không bắt buộc chọn industry (có thể skip)
**UX:** Card selector thay vì dropdown — visual hơn, ít click hơn

---

## Bước 3: Đặt mục tiêu đầu tiên

```
┌─────────────────────────────────┐
│  Bước 2/5 ▓▓▓▓░░░░░░           │
│                                 │
│  🎯 Bạn muốn đạt được gì       │
│  trong tháng tới?               │
│                                 │
│  Chọn 1 mục tiêu chính:        │
│                                 │
│  ┌─────────────────────────┐    │
│  │ 💰 Tăng doanh thu       │    │
│  │    VD: Đạt 50 triệu/th  │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ 📦 Tăng đơn hàng        │    │
│  │    VD: 100 đơn/tháng    │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ ✍️ Tạo nội dung         │    │
│  │    VD: 20 bài/tháng     │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ 👥 Thu hút khách hàng   │    │
│  │    VD: 500 leads/tháng  │    │
│  └─────────────────────────┘    │
│                                 │
│  Con số mục tiêu:               │
│  ┌──────┐                       │
│  │ 50   │ triệu VNĐ            │
│  └──────┘                       │
│                                 │
│  [ ← Quay lại ] [ Tiếp tục → ] │
└─────────────────────────────────┘
```

**Action:** Chọn goal type + nhập target value → save vào `goals`
**Auto-create:** KPIs tương ứng (VD: chọn "Tăng đơn hàng" → tạo KPI "Đơn hàng/tháng")
**UX:** Gợi ý con số dựa trên industry + team size từ bước 2

---

## Bước 4: Cài đặt Playbook (aha moment)

```
┌─────────────────────────────────┐
│  Bước 3/5 ▓▓▓▓▓▓░░░░           │
│                                 │
│  🤖 BizMate gợi ý quy trình    │
│  phù hợp cho bạn:               │
│                                 │
│  ┌─────────────────────────┐    │
│  │ ⭐ Đề xuất cho bạn      │    │
│  │                         │    │
│  │ 🛒 Shopee Auto-Order    │    │
│  │ Tự động xử lý đơn hàng, │    │
│  │ trả lời khách, update   │    │
│  │ inventory                │    │
│  │                         │    │
│  │ Bao gồm:                │    │
│  │ • Agent xử lý đơn       │    │
│  │ • Agent trả lời chat    │    │
│  │ • Report hàng ngày      │    │
│  │                         │    │
│  │ [ Cài đặt ngay ✓ ]     │    │
│  └─────────────────────────┘    │
│                                 │
│  Playbook khác:                 │
│  ┌────────┐ ┌────────┐         │
│  │ ✍️ Blog │ │ 📧 Email│         │
│  │Generator│ │Campaign│         │
│  └────────┘ └────────┘         │
│                                 │
│  [ ← Quay lại ] [ Tiếp tục → ] │
└─────────────────────────────────┘
```

**Action:** Click "Cài đặt ngay" → tạo `installed_playbooks` + spawn agents tương ứng
**Logic gợi ý:** Dựa trên industry (bước 2) + goal (bước 3):
- TMĐT + đơn hàng → "Shopee Auto-Order"
- Nội dung + posts → "Blog Generator"
- B2B + leads → "Lead Gen Pipeline"
**UX:** Highlight 1 playbook "Đề xuất" — giảm decision fatigue

---

## Bước 5: Kết nối nền tảng (Optional — có thể skip)

```
┌─────────────────────────────────┐
│  Bước 4/5 ▓▓▓▓▓▓▓▓░░           │
│                                 │
│  🔗 Kết nối tài khoản           │
│  (không bắt buộc)               │
│                                 │
│  ┌─────────────────────────┐    │
│  │ 🟠 Shopee Seller        │    │
│  │ [ Kết nối ]             │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ 🔵 Lazada Seller        │    │
│  │ [ Kết nối ]             │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ 📱 Zalo OA              │    │
│  │ [ Kết nối ]             │    │
│  └─────────────────────────┘    │
│                                 │
│  💡 Bạn có thể kết nối sau     │
│  trong phần Cài đặt             │
│                                 │
│  [ ← Quay lại ] [ Bỏ qua → ]  │
└─────────────────────────────────┘
```

**Action:** OAuth flow cho từng platform → save vào `integrations`
**Skip:** Hoàn toàn optional — "Bỏ qua" → sang bước 6
**UX:** Nếu chưa có API access, disable button + show "Sắp ra mắt"

---

## Bước 6: Dashboard — First Value

```
┌─────────────────────────────────┐
│  ✅ Hoàn tất! ▓▓▓▓▓▓▓▓▓▓       │
│                                 │
│  🎉 Shop Hạnh Phúc đã sẵn      │
│  sàng hoạt động!                │
│                                 │
│  ┌─────────────────────────┐    │
│  │  🎯 Mục tiêu tháng này  │    │
│  │  100 đơn hàng            │    │
│  │  ████░░░░░░ 0/100        │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │  🤖 Agents đang chạy    │    │
│  │  • Kiến 🐜 Xử lý đơn   │    │
│  │  • Thép ⚙️ Trả lời chat │    │
│  │  • Minh 📋 Report        │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │  💡 Thử ngay:            │    │
│  │  [ Tạo task đầu tiên → ] │    │
│  └─────────────────────────┘    │
│                                 │
│  [ Khám phá Dashboard → ]      │
└─────────────────────────────────┘
```

**Action:** Show dashboard summary + CTA "Tạo task đầu tiên"
**Auto-trigger:** Playbook đã cài tự chạy task demo (nếu có connection)
**Aha moment:** CEO thấy agents đã sẵn sàng, mục tiêu đã set, chỉ cần click 1 nút

---

## Tóm tắt technical

| Bước | Table writes | API calls |
|------|-------------|-----------|
| 1. Signup | profiles, workspaces | Supabase Auth |
| 2. Company | companies | POST /api/v1/companies |
| 3. Goal | goals, kpis (auto) | POST /api/v1/goals |
| 4. Playbook | installed_playbooks, agents (spawn) | POST /api/v1/playbooks/install |
| 5. Connect | integrations | OAuth redirect → callback |
| 6. Dashboard | — (read only) | GET /api/v1/dashboard |

**Tổng API mới cần build:** 4 endpoints (companies, goals, playbooks/install, dashboard)
**Tổng thời gian user:** ~3-5 phút (target < 5 phút)

---

## Open Questions

1. [ ] Bước 1: Google/Facebook OAuth hay chỉ email/password cho MVP?
2. [ ] Bước 3: Có nên cho phép multi-goal hay chỉ 1 goal ban đầu?
3. [ ] Bước 4: Có sẵn playbook templates nào? Ai tạo content?
4. [ ] Bước 5: Shopee API access — đã confirm partnership chưa?
5. [ ] Bước 6: Demo task nên là gì? (VD: "Tạo 1 bài review sản phẩm")
