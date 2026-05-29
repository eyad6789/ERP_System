#!/usr/bin/env bash
set -euo pipefail

# Wait for Postgres, then migrate and launch whatever command was passed.
echo "Waiting for database at ${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}..."
until python -c "
import os, socket
s = socket.socket()
s.settimeout(2)
s.connect((os.environ.get('POSTGRES_HOST','postgres'), int(os.environ.get('POSTGRES_PORT','5432'))))
s.close()
" 2>/dev/null; do
  sleep 1
done

# Only the api service runs migrations (RUN_MIGRATIONS=1); workers skip it.
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  python manage.py migrate --noinput
fi

exec "$@"
