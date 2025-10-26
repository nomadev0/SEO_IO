FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir uv \
    && uv pip install --system --no-cache .

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

ENV BACKLINKS_DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/backlinks \
    BACKLINKS_SYNC_DATABASE_URL=postgresql+psycopg://postgres:postgres@db:5432/backlinks \
    BACKLINKS_REDIS_URL=redis://redis:6379/0 \
    BACKLINKS_AUTH_DEV_TOKEN=devtoken-backlinks

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "backlinks.main:app", "--host", "0.0.0.0", "--port", "8000"]
