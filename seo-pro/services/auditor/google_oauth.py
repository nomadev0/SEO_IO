import base64, hashlib, os
from urllib.parse import urlencode
import httpx

# firma state
try:
    from itsdangerous import URLSafeSerializer, BadSignature
    SIGNER_AVAILABLE = True
except Exception:
    URLSafeSerializer = None  # type: ignore
    BadSignature = Exception  # type: ignore
    SIGNER_AVAILABLE = False

from auditor.storage import save_connection, get_connection  # ← tus imports en api.py a veces lo piden desde aquí

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI")

signer = URLSafeSerializer(os.getenv("OAUTH_STATE_SECRET","seo-io-state")) if SIGNER_AVAILABLE else None

AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"

SCOPES = {
    "ga4": ["https://www.googleapis.com/auth/analytics.readonly"],
    "gsc": ["https://www.googleapis.com/auth/webmasters.readonly"],
}

def gen_pkce():
    verifier  = base64.urlsafe_b64encode(os.urandom(40)).decode().rstrip("=")
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    return verifier, challenge

def build_auth_url(provider: str, site: str, code_challenge: str) -> str:
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES[provider]),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "state": signer.dumps({"p": provider, "site": site}) if SIGNER_AVAILABLE and signer else "",
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "prompt": "consent",
    }
    return f"{AUTH_URL}?{urlencode(params)}"

async def exchange_code(code: str, code_verifier: str):
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(TOKEN_URL, data=data); r.raise_for_status()
        return r.json()

async def refresh_access_token(refresh_token: str):
    data = {
        "refresh_token": refresh_token,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(TOKEN_URL, data=data); r.raise_for_status()
        return r.json()
