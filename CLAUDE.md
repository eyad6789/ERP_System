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

---

## Project specifics (this repo)

- The repo root directory name ends with a **trailing space** (`ERP_System `). Always quote paths.
- Architecture: Django + DRF modular monolith. Modules live in `backend/modules/<name>/` with four
  layers: `domain` (pure, no Django imports) / `application` (use-cases + public interface) /
  `infrastructure` (ORM + repositories) / `interfaces` (DRF views/serializers/urls).
- **Hard rule:** modules talk to each other only through another module's `application` layer —
  never import another module's ORM models directly.
- Auth = Django session auth (HttpOnly+Secure+SameSite cookie). No JWT.
- Every state change and access decision writes an append-only `AuditEvent`.

## Local gate commands
```bash
# backend (run from backend/)
ruff check . && ruff format --check . && mypy . && pytest --cov && bandit -r . -c pyproject.toml && semgrep --config .semgrep.yml --error
# frontend (run from frontend/)
npm run lint && npm run typecheck && npm run test
```
