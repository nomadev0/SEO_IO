import base64, hashlib, os, time, sqlite3, json
from typing import Dict, Optional, Tuple
from urllib.parse import urlencode
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

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI")
FERNET_KEY           = os.getenv("FERNET_KEY")
DB_PATH              = os.path.join(os.path.dirname(__file__), "connections.sqlite")

fernet = Fernet(FERNET_KEY) if (FERNET_KEY and Fernet is not None) else None
signer = URLSafeSerializer(os.getenv("OAUTH_STATE_SECRET", "seo-io-state")) if URLSafeSerializer else None
SIGNER_AVAILABLE = signer is not None

AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"

SCOPES = {
    "ga4": ["https://www.googleapis.com/auth/analytics.readonly"],
    "gsc": ["https://www.googleapis.com/auth/webmasters.readonly"],
}

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        site TEXT,
        sub TEXT,                 -- sub del usuario (opcional)
        refresh_token TEXT NOT NULL,
        scopes TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );""")
    conn.commit(); conn.close()

def save_connection(provider:str, site:str, refresh_token:str, scopes:str, sub:str=""):
    init_db()
    rt = fernet.encrypt(refresh_token.encode()).decode() if fernet else refresh_token
    now = int(time.time())
    conn = sqlite3.connect(DB_PATH)
    conn.execute("INSERT INTO connections(provider,site,sub,refresh_token,scopes,created_at,updated_at) VALUES(?,?,?,?,?, ?,?)",
                 (provider, site, sub, rt, scopes, now, now))
    conn.commit(); conn.close()

def get_connection(provider:str, site:str) -> Optional[Dict]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute("SELECT id,provider,site,sub,refresh_token,scopes FROM connections WHERE provider=? AND site=? ORDER BY id DESC LIMIT 1",
                       (provider, site))
    row = cur.fetchone()
    conn.close()
    if not row: return None
    rt = row[4]
    if fernet:
        try: rt = fernet.decrypt(rt.encode()).decode()
        except Exception: pass
    return {"id":row[0], "provider":row[1], "site":row[2], "sub":row[3], "refresh_token":rt, "scopes":row[5]}

def gen_pkce() -> Tuple[str,str]:
    verifier = base64.urlsafe_b64encode(os.urandom(40)).decode().rstrip("=")
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    return verifier, challenge

def build_auth_url(provider:str, site:str, code_challenge:str) -> str:
    if signer is None:
        raise RuntimeError("itsdangerous no está instalado; no se puede generar auth URL.")
    scopes = " ".join(SCOPES[provider])
    state = signer.dumps({"p":provider, "site":site})
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": scopes,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "prompt": "consent",
    }
    return f"{AUTH_URL}?{urlencode(params)}"

async def exchange_code(code:str, code_verifier:str) -> Dict:
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(TOKEN_URL, data=data)
        r.raise_for_status()
        return r.json()

async def refresh_access_token(refresh_token:str) -> Dict:
    data = {
        "refresh_token": refresh_token,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(TOKEN_URL, data=data)
        r.raise_for_status()
        return r.json()


