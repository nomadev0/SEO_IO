"""SEO on-page analyzer utilities."""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, asdict
from typing import Dict, Iterable, List, Optional, Tuple
from selectolax.parser import HTMLParser

WORD_RE = re.compile(r"[A-Za-z0-9']+")
SPACE_RE = re.compile(r"\s+")
SENTENCE_RE = re.compile(r"[\.!?]+")

STOPWORDS = {
    "a","al","ante","con","de","del","el","ella","ellos","en","la","las","lo","los",
    "para","por","que","se","sin","su","sus","un","una","y",
}

@dataclass
class HeadingStats:
    h1: int; h2: int; h3: int; h4: int; h5: int; h6: int

@dataclass
class LinkStats:
    internal: int; external: int; nofollow: int

@dataclass
class MediaStats:
    images: int; images_missing_alt: int; videos: int

@dataclass
class OnPage:
    url: str
    title: str; title_length: int
    meta_description: str; meta_description_length: int
    canonical: Optional[str]; robots_meta: Optional[str]
    headings: HeadingStats; media: MediaStats
    word_count: int
    keyword_score: float; keyword_hits: Dict[str, int]
    recommendations: List[str]
    link_stats: LinkStats
    readability_score: float; reading_time_seconds: int
    def as_dict(self) -> Dict:
        data = asdict(self)
        data["headings"] = asdict(self.headings)
        data["media"] = asdict(self.media)
        data["link_stats"] = asdict(self.link_stats)
        return data

def analyze_html(url: str, html: str, target_keywords: Optional[List[str]] = None) -> OnPage:
    tree = HTMLParser(html)
    title_node = tree.css_first("title")
    title = normalize_text(title_node.text()) if title_node else ""
    meta_desc_node = tree.css_first('meta[name="description"]')
    meta_description = normalize_text(meta_desc_node.attributes.get("content", "") if meta_desc_node else "")
    canonical_node = tree.css_first('link[rel="canonical"]')
    canonical = canonical_node.attributes.get("href") if canonical_node else None
    robots_node = tree.css_first('meta[name="robots"]')
    robots_meta = robots_node.attributes.get("content") if robots_node else None

    headings = HeadingStats(
        h1=len(tree.css("h1")), h2=len(tree.css("h2")), h3=len(tree.css("h3")),
        h4=len(tree.css("h4")), h5=len(tree.css("h5")), h6=len(tree.css("h6"))
    )
    media = collect_media(tree)
    link_stats = collect_links(tree, url)

    text_content = extract_text(tree)
    words = [t.lower() for t in WORD_RE.findall(text_content) if t and t.lower() not in STOPWORDS]
    word_count = len(words)

    keywords = [kw for kw in (target_keywords or []) if kw]
    keyword_score, keyword_hits = keyword_metrics(title, meta_description, text_content, keywords)
    readability = readability_score(text_content, words)
    reading_time_seconds = estimate_reading_time(word_count)

    recommendations = build_recommendations(
        title, meta_description, headings, media, robots_meta, word_count, keyword_score, keywords
    )

    return OnPage(
        url=url,
        title=title, title_length=len(title),
        meta_description=meta_description, meta_description_length=len(meta_description),
        canonical=canonical, robots_meta=robots_meta,
        headings=headings, media=media,
        word_count=word_count,
        keyword_score=keyword_score, keyword_hits=keyword_hits,
        recommendations=recommendations, link_stats=link_stats,
        readability_score=readability, reading_time_seconds=reading_time_seconds,
    )

def normalize_text(value: str) -> str: return SPACE_RE.sub(" ", value).strip()

def extract_text(tree: HTMLParser) -> str:
    body = tree.body
    if not body: return ""
    for n in body.css("script,style,noscript,template"): n.decompose()
    return normalize_text(body.text(separator=" "))

def collect_media(tree: HTMLParser) -> MediaStats:
    images = list(tree.css("img"))
    videos = len(tree.css("video,iframe[src*='youtube'],iframe[src*='vimeo']"))
    images_missing_alt = sum(1 for img in images if not normalize_text(img.attributes.get("alt", "")))
    return MediaStats(images=len(images), images_missing_alt=images_missing_alt, videos=videos)

def collect_links(tree: HTMLParser, origin_url: str) -> LinkStats:
    internal = external = nofollow = 0
    origin_host = get_host(origin_url)
    for a in tree.css("a[href]"):
        href = a.attributes.get("href", "")
        if not href or href.startswith("#") or href.startswith("javascript:"): continue
        anchor_host = get_host(href)
        if anchor_host and origin_host and anchor_host != origin_host: external += 1
        else: internal += 1
        rel = a.attributes.get("rel", "")
        if "nofollow" in rel.lower(): nofollow += 1
    return LinkStats(internal=internal, external=external, nofollow=nofollow)

def get_host(url: str) -> Optional[str]:
    m = re.match(r"^https?://([^/]+)", url)
    return m.group(1).lower() if m else None

def keyword_metrics(title: str, meta_description: str, body_text: str, keywords: Iterable[str]) -> Tuple[float, Dict[str, int]]:
    normalized = body_text.lower()
    hits: Dict[str,int] = {}; total = 0; covered = 0
    for kw in keywords:
        needle = kw.lower().strip()
        if not needle: continue
        total += 1
        hit_count = sum(1 for src in (title.lower(), meta_description.lower(), normalized) if needle in src)
        hits[kw] = hit_count
        if hit_count: covered += 1
    score = (covered / total) if total else 0.0
    return round(score, 3), hits

def readability_score(text: str, tokens: List[str]) -> float:
    sentences = max(1, len(SENTENCE_RE.findall(text)) or text.count("\n"))
    syllables = sum(count_syllables(t) for t in tokens)
    words = max(1, len(tokens))
    score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
    return round(score, 2)

def estimate_reading_time(word_count: int, wpm: int = 200) -> int:
    return math.ceil((word_count / max(1, wpm)) * 60)

def count_syllables(word: str) -> int:
    vowels = "aeiou"; w = word.lower(); c = 0; pv = False
    for ch in w:
        v = ch in vowels
        if v and not pv: c += 1
        pv = v
    return max(1, c)

def build_recommendations(title: str, meta_description: str, headings: HeadingStats,
                          media: MediaStats, robots_meta: Optional[str], word_count: int,
                          keyword_score: float, keywords: List[str]) -> List[str]:
    recs: List[str] = []
    if len(title) < 35: recs.append("Title demasiado corto. Objetivo: 55-60 caracteres.")
    if len(title) > 65: recs.append("Title demasiado largo. Reduce a menos de 65 caracteres.")
    if not meta_description: recs.append("Falta meta description. Incluye propuesta de valor y CTA.")
    if meta_description and (len(meta_description) < 120 or len(meta_description) > 165):
        recs.append("Meta description fuera del rango recomendado (120-165).")
    if headings.h1 == 0: recs.append("No se encontro H1. Define un unico H1 por pagina.")
    if headings.h1 > 1: recs.append("Hay multiples H1. Conserva uno solo.")
    if headings.h2 < 2: recs.append("Se detectan pocos H2. Refuerza la jerarquia del contenido.")
    if media.images_missing_alt: recs.append(f"{media.images_missing_alt} imagen(es) sin atributo alt descriptivo.")
    if word_count < 300: recs.append("Contenido escaso. Considera ampliar el texto clave.")
    if robots_meta and "noindex" in robots_meta.lower(): recs.append("Meta robots incluye noindex. Valida si la pagina debe indexarse.")
    if keyword_score < 0.4 and keywords: recs.append("Baja cobertura de keywords objetivo. Refuerza title, H1 y primeros parrafos.")
    return recs
