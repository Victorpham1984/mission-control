# BizMate Business OS — Critical Blockers

**Last updated:** 2026-03-14
**Status:** 🟡 2/4 resolved, 1 remaining (Shopee API), 1 pending review

## Blocker 1: Playbook Content (P0) — ✅ RESOLVED

**Issue:** "Shopee Auto-Order" playbook steps chưa có nội dung cụ thể.

**Resolution (2026-03-14):** Drafted full playbook với 7 steps, 3 agent skills, 9 action types, fallback mode (no API), FAQ templates. Chờ Sếp Victor review FAQ templates.

**Deliverable:** `docs/planning/bizmate/playbook-shopee-auto-order.md`

**Remaining:** Sếp Victor review 4 FAQ reply templates + confirm auto_process_threshold (2M VNĐ).

---

## Blocker 2: Shopee API Access (P0) — ⏳ OPEN

**Issue:** Chưa confirm được Shopee Seller Center API access.

**Impact:** Integration bước 5 không functional. Tuy nhiên playbook đã có fallback mode (manual CSV).

**Owner:** Sếp Victor (contact Shopee)

**Action:**
- [ ] Check Shopee Open Platform documentation
- [ ] Contact Shopee partnership team (nếu cần)
- [x] Fallback plan: manual CSV upload mode đã design trong playbook

**Decision:** Nếu không có API trong 1 tuần → build manual mode trước, API sau. Playbook fallback mode đã sẵn sàng.

---

## Blocker 3: Playbook Config Schema (P1) — ✅ RESOLVED

**Issue:** `playbooks.config` JSONB structure chưa finalized.

**Resolution (2026-03-14):** Finalized Zod schema với 3 types (PlaybookStep, KpiTemplate, PlaybookConfig) + 6 validation rules. Documented trong `schema-design.md`.

**Deliverables:**
- `schema-design.md` → PlaybookConfig section với full Zod types
- `playbook-shopee-auto-order.md` → Reference implementation (7-step config)

---

## Blocker 4: Companies 1:1 vs 1:N Decision (P1) — ✅ RESOLVED

**Issue:** Schema chưa chốt companies-workspaces relationship.

**Resolution (2026-03-13):** 1:1 cho MVP. UNIQUE constraint confirmed. Multi-company = Phase 4+.

---

## Risk Mitigation Summary

| Blocker | Priority | Status | Timeline |
|---------|----------|--------|----------|
| Playbook content | P0 | ✅ Resolved | 2026-03-14 |
| Shopee API | P0 | ⏳ Open (has fallback) | Chờ Sếp Victor |
| Config schema | P1 | ✅ Resolved | 2026-03-14 |
| 1:1 decision | P1 | ✅ Resolved | 2026-03-13 |

**Next action:** Blocker 2 (Shopee API) — chờ Sếp Victor. Không block development vì đã có manual CSV fallback.
