# Secure Institutional Management System

A secure, bilingual (Arabic-RTL / English-LTR) government/institutional ERP. Full-stack build per
[`BUILD_PLAN.md`](./BUILD_PLAN.md): Django + DRF modular monolith, React + TypeScript + Vite,
PostgreSQL (row-level security), Redis, Celery, Docker Compose, GitHub Actions CI.

> Flagship capabilities: live RBAC + clearance enforcement, an append-only audit log, the
> financial dashboard, and the GIS map. Security is enforced **server-side**, not just hidden in the UI.

## Stack

| Layer    | Choice |
|----------|--------|
| Backend  | Django 5.1 + Django REST Framework, modular monolith |
| Auth     | Session auth (HttpOnly+Secure+SameSite cookie), CSRF, MFA hook |
| Frontend | React 18 + TypeScript + Vite, TanStack Query, MUI (RTL), i18next |
| Charts   | Recharts · Maps: MapLibre GL (self-hostable tiles) |
| Data     | PostgreSQL 16 (row-level security), Redis (cache/sessions/Celery) |
| Infra    | Docker Compose · GitHub Actions full gate |

## Quick start (Docker)

```bash
cp .env.example .env          # edit secrets
docker compose up --build     # boots postgres, redis, api, worker, web
# API health:  http://localhost:8000/health
# Web app:     http://localhost
```

## Local development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python manage.py migrate
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
```

## The gate (must be green before commit)

```bash
# backend (from backend/)
ruff check . && ruff format --check . && mypy . && pytest --cov && bandit -r . -c pyproject.toml && semgrep --config .semgrep.yml --error
# frontend (from frontend/)
npm run lint && npm run typecheck && npm run test
```

See [`CLAUDE.md`](./CLAUDE.md) for the per-task engineering rules and Access-Control Checklist.

## Module layout

Each module under `backend/modules/<name>/` has four layers:
`domain` (pure rules) · `application` (use-cases + public interface) · `infrastructure` (ORM + repos) ·
`interfaces` (DRF views/serializers/urls). Modules interact only through each other's `application` layer.
