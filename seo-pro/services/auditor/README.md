# Auditor (servicio Python)

- API FastAPI en `auditor/api.py` con endpoint `/audit`.
- CLI para CI en `auditor/ci_guardrails.py`.
- Crawler selectivo en `auditor/crawler.py`.

## Desarrollo
```bash
cd services/auditor
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn auditor.api:app --reload


### `/services/auditor/auditor/__init__.py`
```python
# init