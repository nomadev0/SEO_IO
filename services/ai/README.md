# SEO PRO – AI Local Service

This microservicio expone endpoints de IA totalmente locales para la plataforma SEO PRO. Se basa en `fastapi` y puede utilizar un modelo GGUF mediante `llama-cpp-python`, de modo que las respuestas no dependan de APIs externas.

## Requisitos

- Python 3.11+
- CPU con soporte AVX2 (recomendado) o GPU compatible si usas builds personalizados.
- Modelo GGUF almacenado localmente (por ejemplo, `TheBloke/Mistral-7B-Instruct-v0.2-GGUF` cuantizado a `Q4_K_M`).

## Instalación rápida

```bash
cd services/ai
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .
```

Descarga un modelo y define la ruta:

```bash
set LLM_MODEL_PATH=C:\models\mistral-7b-instruct.Q4_K_M.gguf  # PowerShell
# export LLM_MODEL_PATH=/models/mistral-7b-instruct.Q4_K_M.gguf  # Bash
```

## Ejecución

```bash
uvicorn ai_service.app:create_app --factory --host 127.0.0.1 --port 8100 --reload
```

Endpoints principales:

- `GET /health` – verifica estado y disponibilidad del modelo.
- `POST /copilot` – Chat SEO contextual con generación local.
- `POST /prioritise` – Priorización heurística de issues (sin modelo).
- `POST /keywords/cluster` – Clustering de keywords con TF-IDF + KMeans.

## Opcional: Modo resúmenes

Si deseas utilizar pipelines de `transformers` para resúmenes locales, instala las extras:

```bash
pip install -e .[summaries]
```

Luego coloca el modelo en caché usando `HF_HOME` para que funcione sin conexión continua.

## Integración con el Dashboard

1. Arranca `uvicorn` en `127.0.0.1:8100`.
2. Crea variables en el dashboard (`.env.local`):

```
NEXT_PUBLIC_AI_URL=http://127.0.0.1:8100
```

3. Consume los nuevos endpoints desde los módulos React/Node correspondientes (ver `apps/dashboard/lib` para ejemplos).
