from __future__ import annotations

import base64
import hashlib
import os
import sqlite3
import time
from typing import Dict, Optional, Tuple
from urllib.parse import urlencode, urlparse

import httpx

try:
    from cryptography.fernet import Fernet
except ImportError:  # optional dependency
    Fernet = None  # type: ignore

try:
    from itsdangerous import URLSafeSerializer, BadSignature
except ImportError:  # optional dependency
    URLSafeSerializer = None  # type: ignore
    BadSignature = Exception  # type: ignore

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
FERNET_KEY = os.getenv("FERNET_KEY")
DB_PATH = os.path.join(os.path.dirname(__file__), "connections.sqlite")

fernet = Fernet(FERNET_KEY) if (FERNET_KEY and Fernet is not None) else None
signer = URLSafeSerializer(os.getenv("OAUTH_STATE_SECRET", "seo-io-state")) if URLSafeSerializer else None
SIGNER_AVAILABLE = signer is not None

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"

SCOPES = {
    "ga4": [
        "https://www.googleapis.com/auth/analytics.readonly",
        "https://www.googleapis.com/auth/analytics.manage.users.readonly",
    ],
    "gsc": ["https://www.googleapis.com/auth/webmasters.readonly"],
}


def _site_key(raw: str) -> str:
    value = (raw or "").strip()
    if value.startswith("sc-domain:"):
        return value.lower()
    if value and not value.startswith("http"):
        value = f"https://{value}"
    parsed = urlparse(value or "")
    host = (parsed.hostname or value).lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT NOT NULL,
            site TEXT NOT NULL,
            sub TEXT,
            refresh_token TEXT NOT NULL,
            scopes TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS selections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            site TEXT UNIQUE,
            ga4_property TEXT,
            gsc_site_url TEXT,
            updated_at INTEGER NOT NULL
        );"""
    )
    conn.commit()
    conn.close()


def _enc(rt: str) -> str:
    return fernet.encrypt(rt.encode()).decode() if fernet else rt


def _dec(rt: str) -> str:
    if not fernet:
        return rt
    try:
        return fernet.decrypt(rt.encode()).decode()
    except Exception:
        return ""


def save_connection(provider: str, site: str, refresh_token: str, scopes: str, sub: str = "") -> None:
    init_db()
    now = int(time.time())
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO connections(provider,site,sub,refresh_token,scopes,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        (provider, _site_key(site), sub, _enc(refresh_token), scopes, now, now),
    )
    conn.commit()
    conn.close()


def get_connection(provider: str, site: str) -> Optional[Dict[str, str]]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT id, provider, site, sub, refresh_token, scopes FROM connections WHERE provider=? AND site=? ORDER BY id DESC LIMIT 1",
        (provider, _site_key(site)),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0],
        "provider": row[1],
        "site": row[2],
        "sub": row[3],
        "refresh_token": _dec(row[4]),
        "scopes": row[5],
    }


def save_selection(site: str, ga4_property: Optional[str] = None, gsc_site_url: Optional[str] = None) -> None:
    init_db()
    key = _site_key(site)
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT id FROM selections WHERE site=?", (key,)).fetchone()
    now = int(time.time())
    if row:
        conn.execute(
            "UPDATE selections SET ga4_property=COALESCE(?, ga4_property), gsc_site_url=COALESCE(?, gsc_site_url), updated_at=? WHERE site=?",
            (ga4_property, gsc_site_url, now, key),
        )
    else:
        conn.execute(
            "INSERT INTO selections(site, ga4_property, gsc_site_url, updated_at) VALUES(?,?,?,?)",
            (key, ga4_property, gsc_site_url, now),
        )
    conn.commit()
    conn.close()


def get_selection(site: str) -> Optional[Dict[str, Optional[str]]]:
    init_db()
    key = _site_key(site)
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT ga4_property, gsc_site_url FROM selections WHERE site=?", (key,)).fetchone()
    conn.close()
    if not row:
        return None
    return {"site": key, "ga4_property": row[0], "gsc_site_url": row[1]}


def gen_pkce() -> Tuple[str, str]:
    verifier = base64.urlsafe_b64encode(os.urandom(40)).decode().rstrip("=")
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    return verifier, challenge


def build_auth_url(provider: str, site: str, code_challenge: str) -> str:
    if signer is None:
        raise RuntimeError("itsdangerous no está instalado; no se puede generar auth URL.")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES[provider]),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "state": signer.dumps({"p": provider, "site": _site_key(site)}),
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "prompt": "consent",
    }
    return f"{AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str, code_verifier: str) -> Dict[str, str]:
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(TOKEN_URL, data=data)
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> Dict[str, str]:
    data = {
        "refresh_token": refresh_token,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(TOKEN_URL, data=data)
        resp.raise_for_status()
        return resp.json()


async def discover_gsc_site(site: str, access_token: str) -> Optional[str]:
    key = _site_key(site)
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get("https://www.googleapis.com/webmasters/v3/sites", headers=headers)
        if resp.status_code != 200:
            return None
        payload = resp.json()
    entries = payload.get("siteEntry", []) if isinstance(payload, dict) else []
    fallback = None
    for entry in entries:
        site_url = entry.get("siteUrl", "")
        norm = _site_key(site_url)
        if norm == key:
            return site_url
        if fallback is None:
            fallback = site_url
    return fallback


async def discover_ga4_property(site: str, access_token: str) -> Optional[str]:
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", headers=headers)
        if resp.status_code != 200:
            return None
        payload = resp.json()
    key = _site_key(site)
    fallback = None
    for summary in payload.get("accountSummaries", []):
        for prop in summary.get("propertySummaries", []):
            pid = prop.get("property")
            name = (prop.get("displayName") or "").lower()
            if fallback is None:
                fallback = pid
            if key in name or (pid and key in pid.lower()):
                return pid
    return fallback


__all__ = [
    "SCOPES",
    "SIGNER_AVAILABLE",
    "BadSignature",
    "build_auth_url",
    "discover_ga4_property",
    "discover_gsc_site",
    "exchange_code",
    "gen_pkce",
    "get_connection",
    "get_selection",
    "refresh_access_token",
    "save_connection",
    "save_selection",
    "signer",
    "_site_key",
]
