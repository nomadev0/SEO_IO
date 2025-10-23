from __future__ import annotations
import os, time
from typing import Optional, Dict, Any
from sqlmodel import Field, SQLModel, Session, select, create_engine
from cryptography.fernet import Fernet

DB_URL = os.getenv("DB_URL", f"sqlite:///{os.path.join(os.path.dirname(__file__),'seo_io.sqlite3')}")
FERNET_KEY = os.getenv("FERNET_KEY")  # genera con Fernet.generate_key()
fernet = Fernet(FERNET_KEY) if FERNET_KEY else None
engine = create_engine(DB_URL, connect_args={"check_same_thread": False})

class Connection(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    provider: str
    site: str
    sub: Optional[str] = None
    refresh_token_enc: str
    scopes: str
    created_at: int = Field(default_factory=lambda: int(time.time()))
    updated_at: int = Field(default_factory=lambda: int(time.time()))

class Selection(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    site: str
    ga4_property_id: Optional[str] = None
    gsc_site_url: Optional[str] = None
    updated_at: int = Field(default_factory=lambda: int(time.time()))

def init_db():
    SQLModel.metadata.create_all(engine)

def _enc(rt: str) -> str:
    return fernet.encrypt(rt.encode()).decode() if fernet else rt

def _dec(rt: str) -> str:
    if not fernet: return rt
    try: return fernet.decrypt(rt.encode()).decode()
    except Exception: return ""

# -------- API pública (encaja con tus imports) --------
def save_connection(provider: str, site: str, refresh_token: str, scopes: str, sub: str | None = None) -> None:
    init_db()
    now = int(time.time())
    with Session(engine) as s:
        c = Connection(provider=provider, site=site, sub=sub, refresh_token_enc=_enc(refresh_token),
                       scopes=scopes, created_at=now, updated_at=now)
        s.add(c); s.commit()

def get_connection(provider: str, site: str) -> Optional[Dict[str, Any]]:
    init_db()
    with Session(engine) as s:
        row = s.exec(select(Connection).where(
            Connection.provider==provider, Connection.site==site
        ).order_by(Connection.id.desc())).first()
        if not row: return None
        return {
            "id": row.id,
            "provider": row.provider,
            "site": row.site,
            "refresh_token": _dec(row.refresh_token_enc),
            "scopes": row.scopes,
        }

def decode_refresh_token(conn: Dict[str, Any]) -> str:
    # compatibilidad: tu api.py a veces usa conn["refresh_token"] directo
    return conn.get("refresh_token","")

def upsert_selection(site: str, ga4_property_id: str | None = None, gsc_site_url: str | None = None):
    init_db()
    with Session(engine) as s:
        sel = s.exec(select(Selection).where(Selection.site == site)).first()
        if not sel:
            sel = Selection(site=site, ga4_property_id=ga4_property_id, gsc_site_url=gsc_site_url)
            s.add(sel)
        else:
            if ga4_property_id is not None: sel.ga4_property_id = ga4_property_id
            if gsc_site_url   is not None: sel.gsc_site_url   = gsc_site_url
            sel.updated_at = int(time.time())
        s.commit(); s.refresh(sel); return sel

def get_selection(site: str) -> Optional[Dict[str, Any]]:
    init_db()
    with Session(engine) as s:
        sel = s.exec(select(Selection).where(Selection.site==site)).first()
        if not sel: return None
        return {"site": sel.site, "ga4_property_id": sel.ga4_property_id, "gsc_site_url": sel.gsc_site_url}
