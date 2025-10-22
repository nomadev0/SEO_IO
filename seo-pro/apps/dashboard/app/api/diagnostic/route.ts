import { NextRequest, NextResponse } from 'next/server';

const AUDITOR_URL =
  process.env.AUDITOR_URL?.replace(/\/$/, '') ??
  process.env.NEXT_PUBLIC_AUDITOR_URL?.replace(/\/$/, '') ??
  'http://127.0.0.1:8000';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    targetUrl?: string;
    keywords?: string;
    maxUrls?: number;
    psiStrategy?: 'mobile' | 'desktop';
    gscProperty?: string;
    serpKeyword?: string;
    serpLocation?: string;
  };

  const targetUrl = body.targetUrl?.trim();
  if (!targetUrl) {
    return NextResponse.json({ error: 'targetUrl es obligatorio' }, { status: 400 });
  }

  const keywords = body.keywords ?? '';
  const maxUrls = Math.max(20, Math.min(body.maxUrls ?? 80, 500));
  const psiStrategy = body.psiStrategy === 'desktop' ? 'desktop' : 'mobile';

  const params = new URLSearchParams({
    url: targetUrl,
    keywords,
    max_urls: String(maxUrls),
    psi_strategy: psiStrategy,
  });
  if (body.gscProperty) params.set('gsc_property', body.gscProperty);
  if (body.serpKeyword) params.set('serp_keyword', body.serpKeyword);
  if (body.serpLocation) params.set('serp_location', body.serpLocation);

  try {
    const response = await fetch(`${AUDITOR_URL}/diagnostic?${params.toString()}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json({ error: `Auditor respondió ${response.status}: ${text}` }, { status: 502 });
    }
    const payload = await response.json();
    return NextResponse.json(payload, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido llamando al auditor';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
