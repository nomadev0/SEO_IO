## SEO PRO Platform

An end-to-end SEO workspace that combines a technical crawler, on-page analyzer and PageSpeed Insights bridge. The stack is split into:

- `services/auditor`: FastAPI service that crawls, runs rule-based checks and performs advanced on-page analysis.
- `services/ai`: FastAPI microservice for local AI-driven insights (copilot, prioritisation, keyword clustering).
- `apps/dashboard`: Next.js dashboard to orchestrate audits, visualise findings and share action plans.

### Quickstart

```bash
# 1. Auditor API
cd services/auditor
python -m venv .venv
source .venv/bin/activate  # On Windows use .venv\Scripts\activate
pip install -e .
uvicorn auditor.api:app --reload  # http://localhost:8000/health

# 2. Dashboard
cd ../../apps/dashboard
npm install
npm run dev  # http://localhost:4000
```

```bash
# 3. Datahub (opcional para datos externos)
cd ../datahub
pip install -e .
```

Set these environment variables in `apps/dashboard/.env.local` if the services run on custom hosts:

```
NEXT_PUBLIC_AUDITOR_URL=http://127.0.0.1:8000
NEXT_PUBLIC_AI_URL=http://127.0.0.1:8100
```

Optional (para datos de GSC/rankings/backlinks):

```
# Search Console
GSC_SERVICE_ACCOUNT_FILE=/ruta/credenciales.json
# o define GSC_SERVICE_ACCOUNT_JSON con el contenido

# Rank tracking via SerpAPI
SERP_API_KEY=tu_api_key
SERP_LOCATION="Spain"

# Backlinks (Ahrefs)
BACKLINK_PROVIDER=ahrefs
BACKLINK_API_KEY=tu_token
BACKLINK_API_BASE=https://apiv2.ahrefs.com
```

### Features

- Technical crawl with severity-weighted rule engine and CI guardrails.
- On-page analyzer with keyword coverage, readability score, link/media stats and actionable recommendations.
- PageSpeed Insights integration including heavy resource breakdown.
- Filtering, severity charts and triage tooling directly in the dashboard.

### Próximos pasos sugeridos

1. **Integración de datos reales**: crear un servicio de proyectos que ingeste Google Search Console y GA4 a diario (ETL + BigQuery/ClickHouse) y exponga `/projects/{id}/overview` para poblar el dashboard con tráfico, CTR y queries reales.
2. **Planificador de auditorías/PSI**: programar crawls recurrentes y lotes de PageSpeed (con caché de resultados) para evitar límites de la API y mostrar tendencias.
3. **Rank tracking y backlinks**: desplegar un microservicio de SERP tracking multipaís y conectores de backlinks (Majestic/Ahrefs) para reemplazar métricas dummy por datos vivos.
4. **Alertas y reporting**: generar alertas automáticas (Slack/email/webhook) ante caídas de rankings o issues críticos y automatizar reportes PDF/Slides.

### Roadmap Ideas

- Extender la rulebook con hreflang, sitemap freshness y Core Web Vitals por plantilla.
- Incorporar colaboración (comentarios, Slack, exportación a tickets).
- Publicar auto-fixes (structured data, meta tags, optimización de imágenes).

### Contributing

Run `npm run lint` and `pytest` before pushing. The repo ships with SEO guardrails that fail CI when critical regressions appear. See `services/auditor/auditor/ci_guardrails.py` for details.
