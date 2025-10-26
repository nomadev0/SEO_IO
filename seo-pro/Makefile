COMPOSE = docker compose -f infra/docker-compose.yml

.PHONY: up down migrate seed api web worker test lint

up:
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

migrate:
	$(COMPOSE) run --rm api uv run alembic upgrade head

seed:
	$(COMPOSE) run --rm api uv run python -m backlinks.seeds.seed_demo

api:
	cd services/backlinks && uv run uvicorn backlinks.main:app --reload --host 0.0.0.0 --port 8000

worker:
	cd services/backlinks && uv run rq worker backlinks

web:
	npm run dev --prefix apps/dashboard

test:
	cd services/backlinks && uv run pytest
	cd apps/dashboard && npm run test

lint:
	cd services/backlinks && uv run ruff check .
	npm run lint --prefix apps/dashboard
