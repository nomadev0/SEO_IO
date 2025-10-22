"""CI helper to block merges when critical SEO issues are detected."""

from __future__ import annotations

import asyncio
import json
import os
import sys

from auditor.crawler import crawl
from auditor.rules import RULES

BASE_URL = os.getenv("BASE_URL")
MAX_URLS = int(os.getenv("MAX_URLS", "30"))
CRITICAL_CODES = {"NOINDEX_ACCIDENTAL", "HTTP_STATUS_ERROR"}


def run_checks(pages):
    failures = []
    for url, status, html in pages:
        if status >= 400:
            failures.append((url, "HTTP_STATUS_ERROR", {"status": status}))
            continue
        for rule in RULES:
            evidence = rule.check(url, html)
            if evidence:
                failures.append((url, rule.code, evidence))
    return failures


def main() -> None:
    if not BASE_URL:
        print("No BASE_URL provided; skipping SEO guardrails.")
        sys.exit(0)

    pages = asyncio.run(crawl(BASE_URL, max_urls=MAX_URLS))
    failures = run_checks(pages)

    critical = [item for item in failures if item[1] in CRITICAL_CODES]
    for url, code, evidence in failures:
        print(f"[{code}] {url} -> {json.dumps(evidence)}")

    if critical:
        print(f"Critical SEO issues: {len(critical)}. Blocking merge.")
        sys.exit(1)

    print("SEO guardrails passed.")


if __name__ == "__main__":
    main()
