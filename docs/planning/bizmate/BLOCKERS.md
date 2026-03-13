# BizMate Business OS — Critical Blockers

**Last updated:** 2026-03-13
**Status:** 🔴 Must resolve before coding UI

## Blocker 1: Playbook Content (P0)

**Issue:** "Shopee Auto-Order" playbook steps chưa có nội dung cụ thể.

**Impact:** Onboarding bước 4 không thể build nếu không biết playbook làm gì.

**Owner:** Sếp Victor + Đệ

**Action:**
- [ ] Draft 1 playbook example đầy đủ: Shopee Auto-Order
- [ ] Define: steps, agent skills, config, expected actions
- [ ] Timeline: tuần này (trước 2026-03-20)

**Deliverable:** `docs/planning/bizmate/playbook-shopee-auto-order.md`

---

## Blocker 2: Shopee API Access (P0)

**Issue:** Chưa confirm được Shopee Seller Center API access.

**Impact:** Integration bước 5 không functional.

**Owner:** Sếp Victor (contact Shopee)

**Action:**
- [ ] Check Shopee Open Platform documentation
- [ ] Contact Shopee partnership team (nếu cần)
- [ ] Fallback plan: build manual CSV upload mode

**Decision:** Nếu không có API trong 1 tuần → build manual mode trước, API sau.

---

## Blocker 3: Playbook Config Schema (P1)

**Issue:** `playbooks.config` JSONB structure chưa finalized.

**Impact:** Không thể validate config khi user customize playbook.

**Owner:** Đệ + Claude Code

**Action:**
- [ ] Draft 1 example config JSON đầy đủ (based on Shopee Auto-Order)
- [ ] Define validation rules
- [ ] Document trong schema-design.md

**Timeline:** sau khi Blocker 1 xong

---

## Blocker 4: Companies 1:1 vs 1:N Decision (P1)

**Issue:** Schema chưa chốt companies-workspaces relationship.

**Decision:** Đệ recommend 1:1 cho MVP.

**Rationale:**
- Đơn giản hóa billing, RLS, onboarding
- SME owner ít khi quản trị >1 công ty trong 1 dashboard
- Multi-company = enterprise feature (Phase 4+)

**Action:**
- [x] Decision: 1:1 cho MVP
- [ ] Update schema-design.md với UNIQUE constraint confirmed

---

## Risk Mitigation Summary

| Blocker | Priority | Timeline | Fallback |
|---------|----------|----------|----------|
| Playbook content | P0 | Week 1 | Generic task template |
| Shopee API | P0 | Week 1-2 | Manual CSV mode |
| Config schema | P1 | Week 2 | Hardcode first playbook |
| 1:1 decision | P1 | Resolved | — |
