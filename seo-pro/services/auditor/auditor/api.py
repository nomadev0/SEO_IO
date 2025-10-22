"""SEO PRO Auditor API."""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from auditor.analyzer import analyze_html
from auditor.crawler import crawl
from auditor.rules import RULES

try:
    from datahub import (
        fetch_backlink_overview,
        fetch_rank_positions,
        fetch_search_console_summary,
    )
except ImportError:  # datahub is optional at runtime
    fetch_backlink_overview = None  # type: ignore
    fetch_rank_positions = None  # type: ignore
    fetch_search_console_summary = None  # type: ignore

app = FastAPI(title="SEO PRO Auditor", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PSI_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
_PSI_CACHE: Dict[Tuple[str, str], Tuple[float, Dict[str, Any]]] = {}
_PSI_TTL = 60 * 60


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "version": app.version}


@app.get("/audit")
async def audit(base_url: str, max_urls: int = Query(default=50, ge=10, le=500)) -> Dict[str, Any]:
    return await _run_audit(base_url, max_urls)


@app.get("/analyze")
async def analyze(url: str, keywords: str = "") -> Dict[str, Any]:
    kws = [k.strip() for k in keywords.split(",") if k.strip()]
    html = await _fetch_html(url)
    onpage = analyze_html(url, html, kws)
    return onpage.as_dict()


@app.get("/psi")
async def psi(url: str, strategy: str = Query(default="mobile", pattern="^(mobile|desktop)$")) -> Dict[str, Any]:
    return await _run_psi(url, strategy)


@app.get("/diagnostic")
async def diagnostic(
    url: str,
    keywords: str = "",
    max_urls: int = Query(default=80, ge=20, le=500),
    psi_strategy: str = Query(default="mobile", pattern="^(mobile|desktop)$"),
    gsc_property: Optional[str] = None,
    serp_keyword: Optional[str] = None,
    serp_location: Optional[str] = None,
) -> Dict[str, Any]:
    """Full diagnostic combining crawl, on-page, PSI and optional external data."""

    base_url = resolve_base(url)
    kws = [k.strip() for k in keywords.split(",") if k.strip()]

    audit_task = _run_audit(base_url, max_urls)
    analyze_task = _run_onpage(url, kws)
    psi_task = _run_psi(url, psi_strategy)

    audit_result, analyze_result, psi_result = await asyncio.gather(
        audit_task, analyze_task, psi_task, return_exceptions=True
    )

    response: Dict[str, Any] = {
        "audit": _wrap_result(audit_result),
        "analysis": _wrap_result(analyze_result),
        "psi": _wrap_result(psi_result),
    }

    # Optional data sources
    response["gsc"] = await _maybe_fetch_gsc(gsc_property or base_url)
    response["rankings"] = await _maybe_fetch_ranking(serp_keyword or (kws[0] if kws else None), base_url)
    response["backlinks"] = await _maybe_fetch_backlinks(base_url)

    return response


async def _run_audit(base_url: str, max_urls: int) -> Dict[str, Any]:
    try:
        pages = await crawl(base_url, max_urls)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error durante el crawl: {exc}") from exc

    issues: List[Dict[str, Any]] = []
    for url, status, html in pages:
        if status >= 400 or status == 0:
            issues.append(
                {
                    "url": url,
                    "rule": "STATUS_4XX_5XX" if status >= 400 else "FETCH_FAILED",
                    "severity": "Critical",
                    "description": "Respuesta HTTP no válida.",
                    "evidence": {"status": status, "message": html[:200]},
                }
            )
            continue
        for rule in RULES:
            evidence = rule.check(url, html)
            if evidence:
                issues.append(
                    {
                        "url": url,
                        "rule": rule.code,
                        "severity": rule.severity,
                        "description": rule.description,
                        "evidence": evidence,
                    }
                )

    return {
        "base_url": base_url,
        "scanned": len(pages),
        "count": len(issues),
        "issues": issues,
    }


async def _run_onpage(url: str, keywords: List[str]) -> Dict[str, Any]:
    html = await _fetch_html(url)
    return analyze_html(url, html, keywords).as_dict()


async def _run_psi(url: str, strategy: str) -> Dict[str, Any]:
    cache_key = (url, strategy)
    now = time.time()
    if cache_key in _PSI_CACHE and (now - _PSI_CACHE[cache_key][0]) < _PSI_TTL:
        data = _PSI_CACHE[cache_key][1]
    else:
        data = await _psi_call(url, strategy)
        _PSI_CACHE[cache_key] = (now, data)

    lr = data.get("lighthouseResult", {}) or {}
    audits = lr.get("audits", {}) or {}
    perf = (lr.get("categories", {}) or {}).get("performance", {}).get("score", None)

    reqs = ((audits.get("network-requests", {}) or {}).get("details", {}) or {}).get("items", []) or []
    heavy = sorted(
        [{"url": i.get("url"), "transfer": i.get("transferSize", 0), "resourceType": i.get("resourceType")} for i in reqs],
        key=lambda x: x["transfer"] or 0,
        reverse=True,
    )[:10]

    return {
        "url": url,
        "strategy": strategy,
        "uses_api_key": bool(os.getenv("PSI_API_KEY")),
        "performance_score": int(perf * 100) if isinstance(perf, (int, float)) else None,
        "metrics": {
            "LCP": (audits.get("largest-contentful-paint") or {}).get("numericValue"),
            "CLS": (audits.get("cumulative-layout-shift") or {}).get("numericValue"),
            "FCP": (audits.get("first-contentful-paint") or {}).get("numericValue"),
            "TBT": (audits.get("total-blocking-time") or {}).get("numericValue"),
        },
        "heavy_requests": heavy,
    }


async def _psi_call(url: str, strategy: str) -> Dict[str, Any]:
    params = {"url": url, "strategy": strategy}
    api_key = os.getenv("PSI_API_KEY")
    if api_key:
        params["key"] = api_key

    async with httpx.AsyncClient(timeout=90.0) as client:
        last_exc: Optional[Exception] = None
        for attempt in range(4):
            try:
                response = await client.get(PSI_URL, params=params)
                if response.status_code == 429:
                    await asyncio.sleep(2 ** attempt)
                    continue
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                last_exc = exc
                if 500 <= exc.response.status_code < 600:
                    await asyncio.sleep(2 ** attempt)
                    continue
                break
            except httpx.RequestError as exc:
                last_exc = exc
                await asyncio.sleep(2 ** attempt)
        raise HTTPException(status_code=502, detail=f"Error PSI: {last_exc}")


async def _fetch_html(url: str) -> str:
    headers = {"User-Agent": "SEO-Pro/1.0"}
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0, headers=headers) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            return response.text
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Error obteniendo HTML: {exc}") from exc


def resolve_base(url: str) -> str:
    try:
        parsed = httpx.URL(url)
        return f"{parsed.scheme}://{parsed.host}"
    except Exception:
        return url


def _wrap_result(result: Any) -> Dict[str, Any]:
    if isinstance(result, Exception):
        message = result.detail if isinstance(result, HTTPException) else str(result)
        return {"ok": False, "error": message}
    return {"ok": True, "data": result}


async def _maybe_fetch_gsc(property_url: Optional[str]) -> Dict[str, Any]:
    if not property_url or fetch_search_console_summary is None:
        return {"available": False, "reason": "Conector de GSC no está configurado."}

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, fetch_search_console_summary, property_url)
    return result


async def _maybe_fetch_ranking(keyword: Optional[str], base_url: str) -> Dict[str, Any]:
    if not keyword or fetch_rank_positions is None:
        return {"available": False, "reason": "Conector de rankings no está configurado."}
    domain = base_url.replace("https://", "").replace("http://", "")
    return await fetch_rank_positions(keyword, domain)


async def _maybe_fetch_backlinks(base_url: str) -> Dict[str, Any]:
    if fetch_backlink_overview is None:
        return {"available": False, "reason": "Conector de backlinks no está configurado."}
    domain = base_url.replace("https://", "").replace("http://", "")
    return await fetch_backlink_overview(domain)
