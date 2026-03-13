# CommandMate — Telegram Command Flow

> Phase 1 | Designed by Đệ 🐾 | 2026-02-18

## Nguyên tắc

1. **Sếp nhắn tự nhiên**, không cần nhớ command
2. **Đệ parse ý định**, hỏi lại nếu thiếu thông tin
3. **Kết quả báo về Telegram**, mở Dashboard khi cần chi tiết

---

## 1. GIAO VIỆC

### Flow cơ bản

```
Sếp: "Viết 5 bài Facebook về son môi mới, tone vui, tuần này xong"

Đệ: "Nhận! Đệ chia thành 5 task:
  1. Bài review sản phẩm
  2. Bài tips makeup với son
  3. Bài before/after
  4. Bài so sánh với đối thủ
  5. Bài user testimonial

  📋 Giao Kiến 🏗️ (skill: content-creation)
  ⏰ Deadline: 23/02
  ✅ Cần Sếp duyệt trước khi publish

  Sếp OK không?"

Sếp: "OK" hoặc "Bỏ bài 4, thêm bài unboxing"

Đệ: "Đã cập nhật! 5 task đang vào queue..."
```

### Đệ tự xử lý khi nào?

| Sếp nói | Đệ hiểu | Hành động |
|---------|---------|-----------|
| "Viết 5 bài FB" | Content task, cần chia nhỏ | Parse → chia 5 sub-tasks → confirm |
| "Check status" | Muốn xem tổng quan | Gọi Metrics API → báo tóm tắt |
| "Giao Thép fix bug login" | Task cụ thể, chỉ định agent | Tạo 1 task → assign Thép |
| "Duyệt hết đi" | Approve tất cả pending | Gọi Approval API → approve all |
| "Cái bài hôm qua sửa lại ngắn hơn" | Reject + feedback | Tìm task → reject + feedback |

### Đệ hỏi lại khi nào?

```
Sếp: "Viết bài"

Đệ: "Sếp ơi, Đệ cần thêm info:
  - Viết cho kênh nào? (Facebook, Email, Blog...)
  - Chủ đề gì?
  - Bao nhiêu bài?
  - Deadline?"
```

**Quy tắc:** Thiếu 1 thông tin → Đệ đoán hợp lý + confirm. Thiếu nhiều → hỏi lại.

---

## 2. THEO DÕI TIẾN ĐỘ

### Sếp hỏi chủ động

```
Sếp: "Status?"

Đệ: "📊 Hôm nay (18/02):
  ✅ 8 tasks xong
  🔄 3 đang chạy
  ⏳ 2 chờ duyệt
  ❌ 1 lỗi (Thép đang retry)

  🏆 Top: Kiến 🏗️ — 5 tasks, 100% approve
  💰 Chi phí: ~$0.45

  Xem chi tiết? → [Mở Dashboard]"
```

### Đệ báo chủ động (không cần Sếp hỏi)

**Khi task xong + cần duyệt:**
```
Đệ: "✅ Bài Facebook #1 xong!
  👷 Kiến 🏗️ | ⏱ 25 phút

  ---
  🌟 Son môi mới từ Brand X — mềm mịn, 
  lên màu chuẩn, giữ 8 tiếng! Mình đã 
  test cả ngày và... [xem thêm]
  ---

  Sếp duyệt không?
  → Reply 'OK' để duyệt
  → Reply feedback để sửa"
```

**Khi task lỗi:**
```
Đệ: "⚠️ Task 'Phân tích data Q1' bị lỗi
  👷 Thép ⚙️ | Lỗi: API timeout
  
  Đệ đã giao lại Minh 📋 retry.
  Nếu fail lần 3 → Đệ sẽ báo Sếp quyết định."
```

**Khi batch xong:**
```
Đệ: "🎉 Batch '5 bài Facebook son môi' hoàn thành!
  ✅ 4/5 approved
  📝 1 đang sửa theo feedback Sếp
  ⏱ Tổng: 2h15m | 💰 $0.15"
```

---

## 3. DUYỆT OUTPUT

### Duyệt nhanh (trên Telegram)

```
Đệ: "[Output preview]
  → Reply 'OK' để duyệt
  → Reply feedback để sửa"

Sếp: "OK"

Đệ: "✅ Đã duyệt! Bài #1 done."
```

### Reject + feedback

```
Sếp: "Ngắn hơn, thêm emoji, bớt formal"

Đệ: "📝 Nhận feedback! Đã gửi lại Kiến 🏗️ sửa.
  Sẽ báo Sếp khi bản mới xong."
```

### Duyệt hàng loạt

```
Sếp: "Duyệt hết"

Đệ: "Có 3 output đang chờ:
  1. Bài FB son môi #2 — Kiến 🏗️
  2. Bài FB son môi #3 — Kiến 🏗️  
  3. Report Q1 — Minh 📋

  Duyệt hết 3 cái? (Reply 'OK' hoặc chọn số để xem trước)"

Sếp: "Xem 3"

Đệ: "[Preview report Q1...]
  OK hay sửa?"
```

### Duyệt phức tạp → mở Dashboard

```
Sếp: "So sánh 5 bài xem cái nào hay nhất"

Đệ: "5 bài cùng lúc thì xem trên Dashboard dễ hơn, Sếp:
  👉 [Link Approval Queue]
  
  Đệ đã sắp xếp theo quality score."
```

---

## 4. QUẢN LÝ AGENT

```
Sếp: "Kiến đang làm gì?"

Đệ: "Kiến 🏗️ — 🟢 Online
  📋 Đang làm: Bài FB son môi #4 (75%)
  📊 Hôm nay: 3 tasks xong, 1 đang làm
  ⭐ Quality: 4.5/5"
```

```
Sếp: "Cho Thép nghỉ đi, chỉ cần Kiến làm content"

Đệ: "OK, Đệ pause Thép ⚙️ khỏi content queue.
  Thép vẫn nhận task code/backend bình thường."
```

---

## 5. BÁO CÁO

### Báo cáo cuối ngày (tự động, 20:00)

```
Đệ: "📊 Báo cáo ngày 18/02:

  Tasks:   15 xong | 2 đang chạy | 1 failed
  Duyệt:  13 approved | 2 revision
  
  Squad:
  🏗️ Kiến — 6 tasks ⭐4.5
  ⚙️ Thép — 4 tasks ⭐4.8  
  📋 Minh — 3 tasks ⭐4.2
  🔍 Soi — 2 tasks (QA)
  
  💰 Chi phí: $0.89
  ⏱ Thời gian trung bình: 28 phút/task

  Chi tiết → [Dashboard]"
```

### Báo cáo tuần (tự động, Thứ 2 9:00)

```
Đệ: "📊 Tuần 08-14/02:

  Tổng: 68 tasks completed
  Approve rate: 91%
  Top performer: Kiến 🏗️ (28 tasks)
  
  💰 Tổng chi phí: $4.20
  📈 So tuần trước: +15% tasks, -8% chi phí
  
  Chi tiết → [Dashboard]"
```

---

## 6. IMPLEMENTATION NOTES (cho Squad)

### Đệ parse lệnh Sếp bằng gì?

**Không cần NLP engine riêng.** Đệ là AI agent (Claude) — tự hiểu ngôn ngữ tự nhiên. Chỉ cần:

1. Đệ nhận tin nhắn từ Sếp qua Telegram
2. Đệ phân tích ý định (giao việc? check status? duyệt?)
3. Đệ gọi CommandMate API tương ứng
4. Đệ format kết quả → reply Telegram

### Đệ gọi API bằng cách nào?

Đệ dùng `exec` tool (curl/fetch) hoặc custom skill gọi CommandMate API.

```
Sếp nhắn → OpenClaw (Đệ) → parse → curl POST /api/v1/tasks → response → format → reply Telegram
```

### Notification push về Telegram

Khi event xảy ra (task complete, fail, etc.):
1. CommandMate API ghi DB
2. Supabase Realtime trigger
3. OpenClaw cron job check mỗi 2 phút (hoặc webhook)
4. Đệ nhắn Telegram cho Sếp

Phase 2+ có thể dùng webhook trực tiếp để realtime hơn.

---

## 7. TELEGRAM-ONLY COMMANDS (backup)

Nếu Sếp muốn dùng command thay vì chat tự nhiên:

| Command | Ý nghĩa |
|---------|---------|
| `/task Viết bài FB...` | Tạo task |
| `/status` | Xem tổng quan |
| `/queue` | Xem approval queue |
| `/approve` | Duyệt task mới nhất |
| `/agents` | Xem danh sách agents |
| `/report` | Báo cáo hôm nay |

**Nhưng nhắn tự nhiên luôn hoạt động.** Commands chỉ là shortcut.
