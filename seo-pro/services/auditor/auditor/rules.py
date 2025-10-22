"""Rule catalog for the crawl-based SEO auditor."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Dict, Optional


@dataclass
class Rule:
    code: str
    severity: str  # Critical/High/Medium/Low
    description: str
    check: Callable[[str, str], Optional[Dict]]


RE_NOINDEX = re.compile(r'<meta[^>]+name=["\']robots["\'][^>]+noindex', re.I)
RE_CANONICAL = re.compile(r'<link[^>]+rel=["\']canonical["\']', re.I)
RE_TITLE = re.compile(r'<title>(.{0,200})</title>', re.I | re.S)
RE_H1 = re.compile(r'<h1[^>]*>([\s\S]*?)</h1>', re.I)
RE_META_DESC = re.compile(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']', re.I)
RE_OG_IMAGE = re.compile(r'<meta[^>]+property=["\']og:image["\']', re.I)
RE_TWITTER_CARD = re.compile(r'<meta[^>]+name=["\']twitter:card["\']', re.I)
RE_LANG = re.compile(r'<html[^>]+lang=["\'][a-z]{2}(?:-[A-Z]{2})?["\']', re.I)


def _title_length_issue(html: str) -> Optional[Dict[str, int]]:
    match = RE_TITLE.search(html)
    if not match:
        return {"length": 0}
    title = match.group(1).strip()
    if len(title) < 30 or len(title) > 65:
        return {"length": len(title)}
    return None


RULES = [
    Rule(
        "NOINDEX_ACCIDENTAL",
        "Critical",
        "Pagina indexable con noindex detectado.",
        lambda _url, html: {"found": True} if RE_NOINDEX.search(html) else None,
    ),
    Rule(
        "CANONICAL_MISSING",
        "High",
        "Falta link rel=canonical en el head.",
        lambda _url, html: {"found": True} if not RE_CANONICAL.search(html) else None,
    ),
    Rule(
        "TITLE_LENGTH",
        "Medium",
        "Title fuera de rango recomendado.",
        lambda _url, html: _title_length_issue(html),
    ),
    Rule(
        "H1_MISSING",
        "Medium",
        "No se encontro un H1 en la pagina.",
        lambda _url, html: {"found": True} if not RE_H1.search(html) else None,
    ),
    Rule(
        "META_DESCRIPTION_MISSING",
        "Medium",
        "Meta description ausente.",
        lambda _url, html: {"found": True} if not RE_META_DESC.search(html) else None,
    ),
    Rule(
        "OPEN_GRAPH_IMAGE_MISSING",
        "Low",
        "Meta og:image ausente.",
        lambda _url, html: {"found": True} if not RE_OG_IMAGE.search(html) else None,
    ),
    Rule(
        "TWITTER_CARD_MISSING",
        "Low",
        "Meta twitter:card ausente.",
        lambda _url, html: {"found": True} if not RE_TWITTER_CARD.search(html) else None,
    ),
    Rule(
        "LANG_ATTRIBUTE_MISSING",
        "Low",
        "Falta atributo lang en la etiqueta html.",
        lambda _url, html: {"found": True} if not RE_LANG.search(html) else None,
    ),
]
