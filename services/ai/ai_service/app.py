"""FastAPI application exposing local AI powered endpoints."""

from __future__ import annotations

import json
from typing import Any, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .keywords import cluster_keywords
from .llm import get_llm
from .prioritizer import Issue, prioritise


class CopilotRequest(BaseModel):
    question: str
    context: Optional[dict[str, Any]] = Field(default=None, description="Structured project context.")
    temperature: Optional[float] = Field(default=None, ge=0.0, le=1.5)


class CopilotResponse(BaseModel):
    answer: str
    llm_available: bool


class IssueInput(BaseModel):
    id: str
    title: str
    severity: str = Field(pattern="^(Critical|High|Medium|Low)$")
    impact: float = Field(default=0.5, ge=0.0, le=1.0)
    effort: float = Field(default=0.5, ge=0.0, le=1.0)
    category: Optional[str] = None


class PrioritiseResponseItem(BaseModel):
    id: str
    title: str
    severity: str
    impact: float
    effort: float
    score: float
    category: Optional[str]


class PrioritiseResponse(BaseModel):
    items: List[PrioritiseResponseItem]


class KeywordClusterRequest(BaseModel):
    keywords: List[str]
    n_clusters: Optional[int] = Field(default=None, ge=1)


class KeywordClusterResponse(BaseModel):
    labels: List[int]
    n_clusters: int


def create_app() -> FastAPI:
    app = FastAPI(title="SEO PRO Local AI", version="0.1.0")
    llm = get_llm()

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"status": "ok", "llm_available": llm.available}

    @app.post("/copilot", response_model=CopilotResponse)
    def copilot(request: CopilotRequest) -> CopilotResponse:
        prompt = _compose_prompt(request.question, request.context)
        answer = llm.generate(prompt, temperature=request.temperature)
        return CopilotResponse(answer=answer, llm_available=llm.available)

    @app.post("/prioritise", response_model=PrioritiseResponse)
    def prioritise_issues(payload: List[IssueInput]) -> PrioritiseResponse:
        if not payload:
            raise HTTPException(status_code=400, detail="Issues payload cannot be empty.")
        ranked = prioritise(
            Issue(
                id=item.id,
                title=item.title,
                severity=item.severity,
                impact=item.impact,
                effort=item.effort,
                category=item.category,
            )
            for item in payload
        )
        items = [
            PrioritiseResponseItem(
                id=item.id,
                title=item.title,
                severity=item.severity,
                impact=item.impact,
                effort=item.effort,
                score=item.score(),
                category=item.category,
            )
            for item in ranked
        ]
        return PrioritiseResponse(items=items)

    @app.post("/keywords/cluster", response_model=KeywordClusterResponse)
    def cluster(payload: KeywordClusterRequest) -> KeywordClusterResponse:
        if not payload.keywords:
            raise HTTPException(status_code=400, detail="Keyword list cannot be empty.")
        labels = cluster_keywords(payload.keywords, payload.n_clusters)
        return KeywordClusterResponse(labels=labels, n_clusters=len(set(labels)))

    return app


def _compose_prompt(question: str, context: Optional[dict[str, Any]]) -> str:
    prompt_parts = [
        "You are SEO PRO Copilot, an expert SEO assistant running entirely on-device.",
        "Answer clearly with actionable steps.",
    ]
    if context:
        serialized = json.dumps(context, indent=2, ensure_ascii=False)
        prompt_parts.append("Project context:")
        prompt_parts.append(serialized)
    prompt_parts.append("Question:")
    prompt_parts.append(question)
    prompt_parts.append("Answer:")
    return "\n".join(prompt_parts)


def main() -> None:
    import uvicorn

    uvicorn.run("ai_service.app:create_app", host="127.0.0.1", port=8100, factory=True)


app = create_app()
