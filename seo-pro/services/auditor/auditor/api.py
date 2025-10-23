"""SEO PRO Auditor API."""

from __future__ import annotations

import asyncio
import datetime as dt
import os
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from auditor.analyzer import analyze_html
from auditor.crawler import crawl
from auditor.rules import RULES
from auditor.google_oauth import (
    SCOPES,
    SIGNER_AVAILABLE,
    BadSignature,
    build_auth_url,
    discover_ga4_property,
    discover_gsc_site,
    exchange_code,
    gen_pkce,
    get_connection,
    get_selection,
    refresh_access_token,
    save_connection,
    save_selection,
    signer,
    _site_key,
)

load_dotenv()

try:  # optional connectors
    from datahub import fetch_backlink_overview, fetch_rank_positions, fetch_search_console_summary
except ImportError:  # pragma: no cover
    fetch_backlink_overview = None  # type: ignore
    fetch_rank_positions = None  # type: ignore
    fetch_search_console_summary = None  # type: ignore

try:  # optional Google SDKs
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.analytics.data_v1beta.types import DateRange, Dimension, Metric, RunReportRequest
    from google.oauth2 import credentials as oauth2_credentials
    from googleapiclient.discovery import build as gsc_build
except ImportError:  # pragma: no cover
    BetaAnalyticsDataClient = None  # type: ignore
    DateRange = Dimension = Metric = RunReportRequest = None  # type: ignore
    oauth2_credentials = None  # type: ignore
    gsc_build = None  # type: ignore

PSI_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
PKCE_STORE: Dict[str, str] = {}
_PSI_CACHE: Dict[Tuple[str, str], Tuple[float, Dict[str, Any]]] = {}
_PSI_TTL = 60 * 60


def _site_variants(site: str) -> Iterable[str]:
    """Return host variations to look up stored connections."""
    key = _site_key(site)
    variants = [
        site,
        key,
        f"https://{key}",
        f"http://{key}",
        f"https://www.{key}",
        f"http://www.{key}",
        f"sc-domain:{key}",
    ]
    seen = set()
    for value in variants:
        value = value.strip()
        if not value or value in seen:
            continue
        seen.add(value)
        yield value


def _get_conn(provider: str, site: str) -> Optional[Dict[str, Any]]:
    for variant in _site_variants(site):
        conn = get_connection(provider, variant)
        if conn:
            return conn
    return None


app = FastAPI(title="SEO PRO Auditor", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "version": app.version}


@app.get("/oauth2/google/start")
def oauth_start(provider: str, site: str) -> JSONResponse:
    if not SIGNER_AVAILABLE or signer is None:
        return JSONResponse({"error": "itsdangerous no instalado; no se puede iniciar OAuth"}, status_code=501)
    if provider not in SCOPES:
        return JSONResponse({"error": "provider inválido"}, status_code=400)
    verifier, challenge = gen_pkce()
    key = f"{provider}:{_site_key(site)}"
    PKCE_STORE[key] = verifier
    auth_url = build_auth_url(provider, site, challenge)
    return JSONResponse({"auth_url": auth_url})


@app.get("/oauth2/google/callback")
async def oauth_callback(request: Request):
    params = dict(request.query_params)
    if "error" in params:
        return JSONResponse({"error": params.get("error"), "desc": params.get("error_description")}, status_code=400)
    code = params.get("code")
    state = params.get("state")
    if not code or not state:
        return JSONResponse({"error": "Código/estado faltante"}, status_code=400)
    if not SIGNER_AVAILABLE or signer is None:
        return JSONResponse({"error": "itsdangerous no instalado; no se puede validar state"}, status_code=501)
    try:
        parsed = signer.loads(state)  # {"p": provider, "site": site}
    except BadSignature:
        return JSONResponse({"error": "state inválido"}, status_code=400)

    provider = parsed.get("p")
    site = parsed.get("site", "")
    key = f"{provider}:{site}"
    verifier = PKCE_STORE.pop(key, None)
    if not verifier:
        return JSONResponse({"error": "PKCE no encontrado (reinicia flujo)"}, status_code=400)

    tokens = await exchange_code(code, verifier)
    refresh_token = tokens.get("refresh_token")
    access_token = tokens.get("access_token")
    if not refresh_token:
        return JSONResponse({"error": "Google no devolvió refresh_token (usa prompt=consent)"}, status_code=400)

    save_connection(provider, site, refresh_token, " ".join(SCOPES.get(provider, [])))

    if provider == "gsc" and access_token:
        selected = await discover_gsc_site(site, access_token)
        if selected:
            save_selection(site, gsc_site_url=selected)
    if provider == "ga4" and access_token:
        property_id = await discover_ga4_property(site, access_token)
        if property_id:
            save_selection(site, ga4_property=property_id)

    return RedirectResponse(url=f"http://localhost:4000/?connected={provider}")


@app.get("/integrations/status")
def integrations_status(site: str) -> Dict[str, bool]:
    return {
        "ga4": _get_conn("ga4", site) is not None,
        "gsc": _get_conn("gsc", site) is not None,
    }


@app.get("/ga4/report")
async def ga4_report(
    site: str,
    property_id: Optional[str] = None,
    start_date: str = "28daysAgo",
    end_date: str = "today",
) -> JSONResponse:
    if BetaAnalyticsDataClient is None or oauth2_credentials is None:
        return JSONResponse(
            {"error": "Dependencias de Google Analytics no instaladas. Ejecuta `pip install google-analytics-data`."},
            status_code=501,
        )
    conn = _get_conn("ga4", site)
    if not conn:
        return JSONResponse({"error": "GA4 no conectado para este sitio."}, status_code=400)
    tokens = await refresh_access_token(conn["refresh_token"])
    access_token = tokens.get("access_token")
    if not access_token:
        return JSONResponse({"error": "No se pudo renovar el token GA4."}, status_code=502)

    sel = get_selection(site) or {}
    prop = property_id or sel.get("ga4_property")
    if not prop:
        prop = await discover_ga4_property(site, access_token)
        if prop:
            save_selection(site, ga4_property=prop)
    if not prop:
        return JSONResponse({"error": "No se encontró una propiedad GA4 asociada."}, status_code=404)

    credentials = oauth2_credentials.Credentials(
        token=access_token,
        refresh_token=conn["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=SCOPES["ga4"],
    )

    client = BetaAnalyticsDataClient(credentials=credentials)
    request = RunReportRequest(
        property=prop,
        date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
        metrics=[
            Metric(name="totalUsers"),
            Metric(name="sessions"),
            Metric(name="screenPageViews"),
        ],
        dimensions=[Dimension(name="date")],
    )
    response = client.run_report(request)
    rows = [
        {
            "date": row.dimension_values[0].value,
            "users": int(row.metric_values[0].value or 0),
            "sessions": int(row.metric_values[1].value or 0),
            "views": int(row.metric_values[2].value or 0),
        }
        for row in response.rows
    ]
    return JSONResponse({"property": prop, "rows": rows})


@app.get("/gsc/query")
async def gsc_query(site: str, start_date: str, end_date: str, dimensions: str = "page,query") -> JSONResponse:
    if gsc_build is None or oauth2_credentials is None:
        return JSONResponse(
            {"error": "Dependencias de Google Search Console no instaladas. Ejecuta `pip install google-api-python-client`."},
            status_code=501,
        )
    conn = _get_conn("gsc", site)
    if not conn:
        return JSONResponse({"error": "GSC no conectado para este sitio."}, status_code=400)
    tokens = await refresh_access_token(conn["refresh_token"])
    access_token = tokens.get("access_token")
    if not access_token:
        return JSONResponse({"error": "No se pudo renovar el token GSC."}, status_code=502)

    sel = get_selection(site) or {}
    site_url = sel.get("gsc_site_url")
    if not site_url:
        site_url = await discover_gsc_site(site, access_token)
        if site_url:
            save_selection(site, gsc_site_url=site_url)
    if not site_url:
        return JSONResponse({"error": "No se encontró una propiedad de Search Console asociada."}, status_code=404)

    credentials = oauth2_credentials.Credentials(
        token=access_token,
        refresh_token=conn["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=SCOPES["gsc"],
    )
    service = gsc_build("searchconsole", "v1", credentials=credentials)
    body = {
        "startDate": start_date,
        "endDate": end_date,
        "dimensions": [d.strip() for d in dimensions.split(",") if d.strip()],
        "rowLimit": 250,
    }
    response = service.searchanalytics().query(siteUrl=site_url, body=body).execute()
    return JSONResponse(response)


@app.get("/audit")
async def audit(base_url: str, max_urls: int = Query(default=50, ge=10, le=500)) -> Dict[str, Any]:
    return await _run_audit(base_url, max_urls)


@app.get("/analyze")
async def analyze(url: str, keywords: str = "") -> Dict[str, Any]:
    kws = [k.strip() for k in keywords.split(",") if k.strip()]
    html = await _fetch_html(url)
    return analyze_html(url, html, kws).as_dict()


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
    site: Optional[str] = None,
) -> Dict[str, Any]:
    base_url = resolve_base(url)
    kws = [k.strip() for k in keywords.split(",") if k.strip()]
    site_ref = site or base_url

    audit_task = _run_audit(base_url, max_urls)
    onpage_task = _run_onpage(url, kws)
    psi_task = _run_psi(url, psi_strategy)

    audit_result, onpage_result, psi_result = await asyncio.gather(
        audit_task, onpage_task, psi_task, return_exceptions=True
    )

    ga4_result = await _maybe_fetch_ga4(site_ref)
    gsc_result = await _maybe_fetch_gsc(gsc_property or base_url, site_ref)
    rankings = await _maybe_fetch_ranking(serp_keyword or (kws[0] if kws else None), base_url)
    backlinks = await _maybe_fetch_backlinks(base_url)

    return {
        "audit": _wrap_result(audit_result),
        "analysis": _wrap_result(onpage_result),
        "psi": _wrap_result(psi_result),
        "ga4": ga4_result,
        "gsc": gsc_result,
        "rankings": rankings,
        "backlinks": backlinks,
    }


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

    return {"base_url": base_url, "scanned": len(pages), "count": len(issues), "issues": issues}


async def _run_onpage(url: str, keywords: List[str]) -> Dict[str, Any]:
    html = await _fetch_html(url)
    return analyze_html(url, html, keywords).as_dict()


async def _run_psi(url: str, strategy: str) -> Dict[str, Any]:
    cache_key = (url, strategy)
    now = time.time()
    cached = _PSI_CACHE.get(cache_key)
    if cached and now - cached[0] < _PSI_TTL:
        data = cached[1]
    else:
        data = await _psi_call(url, strategy)
        _PSI_CACHE[cache_key] = (now, data)

    lighthouse = data.get("lighthouseResult", {}) or {}
    audits = lighthouse.get("audits", {}) or {}
    perf = (lighthouse.get("categories", {}) or {}).get("performance", {}).get("score")

    reqs = ((audits.get("network-requests", {}) or {}).get("details", {}) or {}).get("items", []) or []
    heavy = sorted(
        (
            {"url": i.get("url"), "transfer": i.get("transferSize", 0), "resourceType": i.get("resourceType")}
            for i in reqs
        ),
        key=lambda item: item["transfer"] or 0,
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
                resp = await client.get(PSI_URL, params=params)
                if resp.status_code == 429:
                    await asyncio.sleep(2 ** attempt)
                    continue
                resp.raise_for_status()
                return resp.json()
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
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text


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


async def _maybe_fetch_gsc(property_url: Optional[str], site: str) -> Dict[str, Any]:
    if gsc_build is not None and oauth2_credentials is not None:
        conn = _get_conn("gsc", site)
        if conn:
            tokens = await refresh_access_token(conn["refresh_token"])
            access_token = tokens.get("access_token")
            if not access_token:
                return {"available": False, "reason": "No se pudo renovar el token GSC."}

            sel = get_selection(site) or {}
            site_url = property_url or sel.get("gsc_site_url")
            if not site_url:
                site_url = await discover_gsc_site(site, access_token)
                if site_url:
                    save_selection(site, gsc_site_url=site_url)
            if not site_url:
                return {"available": False, "reason": "Sin propiedad GSC asociada al sitio."}

            credentials = oauth2_credentials.Credentials(
                token=access_token,
                refresh_token=conn["refresh_token"],
                token_uri="https://oauth2.googleapis.com/token",
                client_id=os.getenv("GOOGLE_CLIENT_ID"),
                client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
                scopes=SCOPES["gsc"],
            )
            service = gsc_build("searchconsole", "v1", credentials=credentials)
            end = dt.date.today() - dt.timedelta(days=1)
            start = end - dt.timedelta(days=27)
            body = {"startDate": start.isoformat(), "endDate": end.isoformat(), "dimensions": ["query"], "rowLimit": 25}
            try:
                response = service.searchanalytics().query(siteUrl=site_url, body=body).execute()
            except Exception as exc:  # pragma: no cover
                return {"available": False, "reason": f"Error consultando GSC via OAuth: {exc}"}

            rows = response.get("rows", []) if isinstance(response, dict) else []
            clicks = sum(row.get("clicks", 0) for row in rows)
            impressions = sum(row.get("impressions", 0) for row in rows)
            ctr = clicks / impressions if impressions else 0
            avg_position = (
                sum(row.get("position", 0) for row in rows) / len(rows) if rows else None
            )
            return {
                "available": True,
                "clicks": round(clicks),
                "impressions": round(impressions),
                "ctr": round(ctr, 4),
                "avg_position": round(avg_position, 2) if avg_position is not None else None,
                "top_queries": [
                    {
                        "query": " ".join(row.get("keys", [])),
                        "clicks": row.get("clicks", 0),
                        "impressions": row.get("impressions", 0),
                        "ctr": row.get("ctr", 0),
                        "position": row.get("position", 0),
                    }
                    for row in rows[:10]
                ],
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
            }

    if not property_url or fetch_search_console_summary is None:
        return {"available": False, "reason": "Conector de GSC no está configurado."}
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, fetch_search_console_summary, property_url)
    return result


async def _maybe_fetch_ga4(site: str) -> Dict[str, Any]:
    if BetaAnalyticsDataClient is None or oauth2_credentials is None:
        return {"available": False, "reason": "Dependencias de GA4 no instaladas."}

    conn = _get_conn("ga4", site)
    if not conn:
        return {"available": False, "reason": "GA4 no conectado para este sitio."}

    tokens = await refresh_access_token(conn["refresh_token"])
    access_token = tokens.get("access_token")
    if not access_token:
        return {"available": False, "reason": "No se pudo renovar el token GA4."}

    sel = get_selection(site) or {}
    property_id = sel.get("ga4_property")
    if not property_id:
        property_id = await discover_ga4_property(site, access_token)
        if property_id:
            save_selection(site, ga4_property=property_id)
    if not property_id:
        return {"available": False, "reason": "Sin propiedad GA4 asociada al sitio."}

    credentials = oauth2_credentials.Credentials(
        token=access_token,
        refresh_token=conn["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=SCOPES["ga4"],
    )
    client = BetaAnalyticsDataClient(credentials=credentials)
    end = dt.date.today() - dt.timedelta(days=1)
    start = end - dt.timedelta(days=27)
    request = RunReportRequest(
        property=property_id,
        date_ranges=[DateRange(start_date=start.isoformat(), end_date=end.isoformat())],
        dimensions=[Dimension(name="date")],
        metrics=[
            Metric(name="totalUsers"),
            Metric(name="sessions"),
            Metric(name="screenPageViews"),
        ],
    )
    try:
        response = client.run_report(request)
    except Exception as exc:  # pragma: no cover
        return {"available": False, "reason": f"Error consultando GA4: {exc}"}

    ts = [
        {
            "date": (row.dimension_values[0].value or "").strip(),
            "users": int(row.metric_values[0].value or 0),
            "sessions": int(row.metric_values[1].value or 0),
            "views": int(row.metric_values[2].value or 0),
        }
        for row in response.rows
    ]
    users = sum(point["users"] for point in ts)
    sessions = sum(point["sessions"] for point in ts)
    views = sum(point["views"] for point in ts)
    return {
        "available": True,
        "property_id": property_id,
        "totals": {
            "users": users,
            "sessions": sessions,
            "views": views,
        },
        "timeseries": ts,
    }


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


__all__ = ["app"]
