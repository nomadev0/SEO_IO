import { NextRequest, NextResponse } from 'next/server';

const AUDITOR_URL =
  process.env.AUDITOR_URL?.replace(/\/$/, '') ??
  process.env.NEXT_PUBLIC_AUDITOR_URL?.replace(/\/$/, '') ??
  'http://127.0.0.1:8000';

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get('provider');
  const site = request.nextUrl.searchParams.get('site') ?? '';

  if (!provider) {
    return NextResponse.json({ error: 'provider es obligatorio' }, { status: 400 });
  }

  const params = new URLSearchParams({
    provider,
    site,
  });

  try {
    const response = await fetch(`${AUDITOR_URL}/oauth2/google/start?${params.toString()}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json(
        { error: `Auditor respondió ${response.status}: ${text}` },
        { status: response.status },
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error llamando al auditor';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
