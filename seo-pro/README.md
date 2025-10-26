# SEO Pro · Backlinks Toolkit

Este módulo añade analítica de backlinks al stack existente de SEO Pro. Incluye un servicio FastAPI en `services/backlinks` (Postgres + Redis + RQ) y nuevas vistas en el dashboard principal (`/apps/dashboard`).

## Arquitectura

```
seo-pro/
+- apps/
¦  +- dashboard/        # Next.js App Router, UI principal
+- services/
¦  +- backlinks/        # FastAPI + SQLAlchemy 2 + Alembic + RQ worker
+- infra/               # docker-compose del servicio de backlinks
+- Makefile
+- README.md
```

### Backend (services/backlinks)
- Modelos: dominios, páginas, backlinks, eventos, alerts y outreach con índices clave.
- Alembic + seeds (`seed_demo.py`) generan 3 dominios, 1.5k backlinks y 400 eventos.
- Logging estructurado (`structlog`) y `GET /healthz` para observabilidad.
- Autenticación stub mediante `Authorization: Bearer devtoken-backlinks`.
- Worker RQ simula descubrimiento y eventos de backlinks.
- Tests `pytest` con base SQLite en memoria.

### Frontend (apps/dashboard)
- Secciones nuevas en el dashboard principal con KPIs y actividad reciente de enlaces.
- Página dedicada `/backlinks` con filtros, exportaciones, panel lateral y gráfico “nuevos vs perdidos”.
- API routes (`/app/api/backlinks/*`) actúan como proxy seguro hacia el servicio FastAPI.

## Puesta en marcha rápida

### Opción Docker
```
make up          # levanta Postgres, Redis, API y worker (API expuesta en http://localhost:8100)
make migrate     # aplica migraciones alembic dentro del contenedor
make seed        # crea datos demo
```
Después abre el dashboard desde el repo (ver apartado “Frontend local”).

### Frontend local
```
cd apps/dashboard
npm install
npm run dev      # http://localhost:3000
```
Las llamadas de la UI pasan por los endpoints proxy `/api/backlinks/*`, por lo que el servicio FastAPI debe estar accesible en `BACKLINKS_URL` (por defecto `http://127.0.0.1:8100`).
Copia o ajusta `apps/dashboard/.env.local` para definir `NEXT_PUBLIC_AUDITOR_URL`, `BACKLINKS_URL` y `BACKLINKS_TOKEN`.

### Backend local sin Docker
```
cd services/backlinks
python -m venv .venv
.\.venv\Scripts\activate
pip install --upgrade pip
pip install -e .[dev]
python -m alembic upgrade head
python -m backlinks.seeds.seed_demo
python -m uvicorn backlinks.main:app --reload --host 0.0.0.0 --port 8100
```
Worker (opcional):
```
.\.venv\Scripts\activate
python -m rq worker backlinks
```

## Comandos útiles

| make target | Descripción |
|-------------|-------------|
| `make up`   | docker compose up (db, redis, api, worker) |
| `make down` | detener contenedores |
| `make migrate` | `alembic upgrade head` dentro del servicio |
| `make seed` | poblar datos demo |
| `make api` | ejecutar FastAPI en modo reload (local) |
| `make worker` | arrancar worker RQ local |
| `make web` | `npm run dev` en `apps/dashboard` |
| `make test` | pytest (backend) + npm test (frontend) |
| `make lint` | Ruff para backend y ESLint para dashboard |

## Superficie API

| Ruta | Descripción |
|------|-------------|
| `GET /healthz` | Healthcheck |
| `POST /projects/{id}/domains` | Alta de dominio objetivo/competidor |
| `GET /backlinks` | Listado paginado con filtros (rel, status, q, rango fechas, etc.) |
| `GET /backlinks/events` | stream de eventos (new/lost/changed/recovered) |
| `GET /backlinks/kpis` | KPIs agregados del proyecto |
| `GET /backlinks/series` | Serie temporal nuevos vs perdidos |
| `GET /export/backlinks.csv` | Export CSV según filtros activos |
| `POST /disavow/export` | Genera disavow.txt con filtros vigentes |
| `GET /domains/top` | Dominio con más enlaces entrantes |
| `POST /alerts` / `GET /alerts` | CRUD básico de reglas de alerta |

Todas las rutas esperan el token de desarrollo: `Authorization: Bearer devtoken-backlinks`.

## Experiencia UI
- Resumen de backlinks en el dashboard principal (KPIs + eventos recientes).
- Página específica `/backlinks` con:
  - filtros rápido (rel, estado, búsqueda) y paginado incremental,
  - gráfico comparativo nuevos vs perdidos (7/30/90/custom),
  - exportaciones CSV y disavow desde la misma vista,
  - panel lateral con detalles completos del enlace seleccionado,
  - secciones “Domain overview”, “Organic research”, “Keyword gap” y “Backlink gap” enlazadas desde la sidebar.

## Flujo del worker simulado
1. Selecciona dominio y genera páginas candidato.
2. Calcula enlaces con heurísticas de autoridad/toxicidad.
3. Inserta eventos `LinkEvent` (new/lost/changed) comparando snapshots.

Este flujo permite validar UI y API sin crawler real; sustituir la lógica por integraciones reales en fases posteriores.
