# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for psycopg + healthcheck curl.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
# Runtime image carries only runtime deps; dev/test/SAST tooling runs in CI.
RUN pip install --upgrade pip && pip install -e .

COPY . .
RUN chmod +x entrypoint.sh

# Non-root runtime user.
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Invoke via bash so it works even when a dev bind-mount shadows the exec bit.
ENTRYPOINT ["bash", "/app/entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
