# Secure Institutional Management System — Build Plan & Engineering Playbook
### Demo build (real, working, full-stack) → scale to production after contract award

---

## 0. How to use this document with Claude Code

- Keep this file at the repository root as `BUILD_PLAN.md`. It is the master plan.
- Work **strictly phase by phase, top to bottom**. Do not start a phase until the previous phase's **Verification Gate** is fully green.
- For **every** task, follow the **Per-Task Loop** (§7) and obey the standing rules in `CLAUDE.md` (§2).
- "Done" is defined by the **Definition of Done** + **Verification Gate** for each phase — never by "it looks finished."
- When you (Claude Code) are unsure, stop and ask one specific question rather than guessing on security-relevant code.

---

## 1. What we are building — and what we are NOT building yet

**The DEMO** is a *real, working, secured* full-stack application covering the flagship modules. Its job is to win the contract. It must be honest: every capability shown must actually work.

**The DEMO is NOT** the air-gapped, accredited production system. That transition is §6 and happens **only after award**. Do not prematurely add Kubernetes, microservices, HSM integration, or air-gap tooling during the demo build — they add risk and time with no demo payoff.

**Scope discipline:** depth on flagship modules beats breadth. The features that win the room are: live **RBAC + clearance enforcement**, the **audit log**, the **financial dashboard**, and the **GIS map**. Everything else supports those.

---

## 2. Standing engineering rules (`CLAUDE.md`) — recap

Place this at repo root so it is read before every task:

```markdown
# Engineering rules — read before EVERY task
## Workflow per task
1. Restate the task. Write acceptance criteria + abuse cases BEFORE writing code.
2. Implement the smallest slice that satisfies the spec.
3. Run the full gate: format → lint → type-check → tests → SAST → secret-scan. Fix until green.
4. Run the Access-Control Checklist against every endpoint you touched.
5. Summarize: what changed, what you VERIFIED (with command output), what you did NOT cover.
## Definition of Done
- [ ] Acceptance criteria demonstrated by an automated test
- [ ] Every new endpoint is authenticated AND object-level authorized
- [ ] Any state change writes an audit-log entry (actor, target, time, result)
- [ ] No secrets in code; all config via environment variables
- [ ] Tests green, types clean, lint clean, SAST no high-severity findings
- [ ] Errors return safe messages — no stack traces or internal IDs leaked
## Access-Control Checklist (the #1 source of real breaches)
- [ ] Route requires authentication?
- [ ] Role / clearance checked (RBAC/ABAC)?
- [ ] OBJECT-level ownership checked, not just role? (prevents IDOR)
- [ ] Can a lower-privilege user reach this by editing an ID in the request?
- [ ] Failure denies by default?
## Never
- Never hand-roll crypto or auth primitives — use the framework's.
- Never log secrets, tokens, or full PII.
- Never mark a task done without showing the verification output.
```

---

## 3. Architecture (locked in Phase 0)

- **Backend:** Django + Django REST Framework, structured as a **modular monolith**. Each module (`iam`, `personnel`, `documents`, `finance`, `operations`, `assets`, `gis`, `incidents`) has four internal layers: `domain` (pure rules, no Django imports), `application` (use-cases + the module's public interface), `infrastructure` (ORM models + repositories), `interfaces` (DRF views/serializers/urls).
- **Hard rule:** modules talk to each other only through another module's `application` layer — never by importing its ORM models.
- **Frontend:** React + TypeScript + Vite, TanStack Query, MUI (RTL-ready). Role-based rendering driven by the user's permissions returned from the API.
- **Data:** PostgreSQL with **row-level security** for clearance/department scoping; Redis for cache, sessions, and the Celery queue.
- **Dev infra:** Docker Compose (postgres, redis, api, worker, web). CI: GitHub Actions running the full gate.

---

## 4. Phase 0 — Repository & foundations

**Goal:** a running, empty, fully-gated skeleton. No features yet.

**Tasks**
1. Scaffold the repo structure (§3). Add `CLAUDE.md`, `BUILD_PLAN.md`, `pyproject.toml`, `docker-compose.yml`.
2. Configure the gate tools: `ruff`, `mypy`, `pytest`+`pytest-cov`, `bandit`, `semgrep`, `gitleaks`; frontend `eslint`, `tsc`, `vitest`.
3. Write `.github/workflows/ci.yml` running all gate tools on every push; nothing merges red.
4. Hardened settings split: `base` / `dev` / `prod` (prod: `DEBUG=False`, secure cookies, HSTS, no secrets in code).
5. One trivial health endpoint + one passing test to prove the pipeline is green end-to-end.

**Definition of Done** — `docker compose up` boots all services; `GET /health` returns 200; CI is green on a fresh clone.

**Verification Gate** — CI green; gate tools all run; health test passes; no secrets in the repo (gitleaks clean).

---

## 5. Demo build — phase plan

> Each phase: **Goal → Key tasks → Definition of Done → Verification Gate.** Build the audit log in Phase 1 and write to it from every later phase.

### Phase 1 — IAM & audit core (the spine)
- **Goal:** authentication, the RBAC/ABAC + clearance model, sessions, and the append-only audit log.
- **Key tasks:** user model with role + clearance level (1–4); login with MFA hook; permission layer (role → allowed modules, clearance → max data sensitivity); object-level permission helper; append-only `AuditEvent` model written on every state change and access decision; `GET /me` returning the user's permissions for the frontend.
- **Definition of Done:** a user can log in; a request to a resource above their clearance is denied with an audit entry; every login/role action is logged.
- **Verification Gate:** automated tests prove (a) unauthenticated requests are rejected, (b) a low-clearance user is denied a high-clearance object (IDOR test), (c) every denial and grant produces an audit row. Access-Control Checklist passed for all endpoints.

### Phase 2 — App shell + dashboard
- **Goal:** the bilingual (AR-RTL / EN-LTR) shell, navigation filtered by permissions, and the dashboard with KPIs + financial summary + charts.
- **Key tasks:** layout, sidebar driven by `GET /me`, language toggle, classification banner; dashboard aggregation endpoints (counts, clearance distribution, financial summary, recent audit activity).
- **Definition of Done:** nav shows only permitted modules; dashboard renders live aggregates; switching role changes what's visible.
- **Verification Gate:** tests prove dashboard endpoints enforce permissions; frontend renders RTL and LTR correctly; no aggregate leaks data the user can't see.

### Phase 3 — Personnel
- **Goal:** org hierarchy, personnel directory, clearance levels, profile detail.
- **DoD:** records above the viewer's clearance are excluded server-side (not just hidden in UI); profile view is audit-logged.
- **Gate:** test that a low-clearance user's directory response omits high-clearance people; IDOR test on the profile endpoint.

### Phase 4 — Documents
- **Goal:** documents with classification, versioning, owner, and per-document access log; classification gating.
- **DoD:** a document above the viewer's clearance is never returned in full by the API (title/body withheld server-side); every access is logged.
- **Gate:** test that the document endpoint denies over-clearance reads server-side; access-log entries created on every view.

### Phase 5 — Financial management
- **Goal:** annual budget, expenditure by department/category, procurement/contracts with status, transaction list.
- **DoD:** financial figures roll up correctly; sensitive line items respect clearance; export is permission-checked.
- **Gate:** totals reconcile in tests; over-clearance access to sensitive contracts denied; export endpoint authorized + logged.

### Phase 6 — GIS & mapping
- **Goal:** map of operational sites/assets with toggleable layers and detail popups. (Demo uses a self-hostable tile approach; production is fully self-hosted — see §6.)
- **DoD:** only sites the user is cleared for appear; layer toggles work; clicking a site is audit-logged.
- **Gate:** test that site list is clearance-filtered server-side.

### Phase 7 — Operations, Assets, Incidents
- **Goal:** task/operations board, asset & inventory tracking, incident reporting with severity + status workflow.
- **DoD:** each module CRUDs with permission + audit; incident severity and escalation status modeled.
- **Gate:** permission + IDOR tests per module; state changes audited.

### Phase 8 — Polish & demo hardening
- **Goal:** full bilingual coverage, realistic seed data, visual identity aligned to client branding, performance pass, and a scripted demo path.
- **DoD:** the scripted demo (login → dashboard → role-switch → locked docs → GIS → audit) runs flawlessly with seeded data.
- **Gate:** full regression suite green; lighthouse/perf acceptable; no console errors; seed script reproducible.

---

## 6. Transition to production (only after contract award)

These are explicitly **out of scope for the demo** and become the real-project backlog:

- **Air-gapped deployment:** no internet egress. Self-hosted map tiles, local/on-prem LLM for the AI module, an internal package mirror, offline CI.
- **Cryptography & secrets:** HSM-backed key management, key rotation, secrets vault.
- **Accreditation:** formal threat model sign-off, **independent penetration test**, and the client's compliance/accreditation process before any real data.
- **Scale & resilience:** high-availability topology, database replication/partitioning, disaster-recovery runbook, monitoring stack (Prometheus/Grafana/ELK).
- **Module split (if ever needed):** extract a module into its own service only when a real scaling need proves it — the clean boundaries from §3 make this possible without a rewrite.
- **Data migration:** plan to migrate from seeded demo data to real records under the client's data-classification policy.

---

## 7. Per-task loop (Claude Code follows this on every task)

1. **Spec.** Restate the task. Write acceptance criteria *and* abuse cases ("what should the wrong role get? what about a tampered ID?").
2. **Build** the smallest slice that satisfies the spec.
3. **Gate.** Run format → lint → type-check → tests → SAST → secret-scan locally. Fix until all green.
4. **Self-review.** Re-read your own diff against the Access-Control Checklist for any endpoint touched, and the general Definition of Done.
5. **Report.** State what changed, paste the verification output proving it, and explicitly list what you did *not* cover. Never claim secure/tested without proof.

---

## 8. Verification & self-checking system (detail)

**Automated gates (run in CI, cannot be skipped):**
- `ruff` — lint + format
- `mypy` / `tsc` — type safety
- `pytest --cov` / `vitest` — unit + integration tests, coverage threshold enforced
- `bandit` + `semgrep` — static application security testing (SAST)
- `gitleaks` — secret scanning
- dependency vulnerability scan on every build

**Self-review checklists (Claude Code runs against its own output):**
- *Access-Control Checklist* (in `CLAUDE.md`) — for every endpoint.
- *General DoD* — for every task.
- *Security-sensitive change* — if the diff touches auth, permissions, crypto, or the audit log, flag it explicitly for extra human review; do not treat it as routine.

**The honest boundary:** these checks catch the large majority of routine and common-security bugs. They do **not** replace the independent penetration test and accreditation required before the production system handles real data (§6). Demo-secure and certified-secure are different milestones.

---

## 9. Demo acceptance criteria ("ready to pitch")

- [ ] Login works; MFA hook present; sessions secure.
- [ ] Switching role visibly changes navigation, visible data, and permissions — enforced **server-side**, not just hidden in the UI.
- [ ] At least one over-clearance access is denied live and appears in the audit log as DENIED.
- [ ] Dashboard shows live KPIs + financial summary + charts.
- [ ] Personnel, Documents, Financial, GIS, Operations, Assets, Incidents all render with realistic seeded data.
- [ ] Audit log records every action taken during the demo with actor, action, target, result.
- [ ] Full Arabic-RTL ⇄ English-LTR toggle works across the whole interface.
- [ ] CI fully green; no secrets; SAST clean of high-severity findings.
- [ ] The scripted demo path runs start-to-finish with zero errors.
