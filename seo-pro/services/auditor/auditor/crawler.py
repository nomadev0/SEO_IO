import httpx, asyncio
from selectolax.parser import HTMLParser

async def fetch(client, url):
    try:
        r = await client.get(url, timeout=15.0, follow_redirects=True)
        return url, r.status_code, r.text
    except Exception as e:
        return url, 0, str(e)

async def crawl(base_url: str, max_urls: int = 50):
    seen = set([base_url])
    out = []
    async with httpx.AsyncClient() as client:
        q = [base_url]
        while q and len(out) < max_urls:
            url = q.pop(0)
            url, status, html = await fetch(client, url)
            out.append((url, status, html))
            if status == 200:
                tree = HTMLParser(html)
                for a in tree.css('a[href]'):
                    href = a.attributes.get('href','')
                    if href.startswith('/'):
                        href = base_url.rstrip('/') + href
                    if href.startswith(base_url) and href not in seen and len(seen) < max_urls*5:
                        seen.add(href)
                        q.append(href)
        return out