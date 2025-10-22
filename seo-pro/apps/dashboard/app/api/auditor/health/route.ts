import { NextResponse } from 'next/server';

const AUDITOR_URL =
  process.env.AUDITOR_URL?.replace(/\/$/, '') ??
  process.env.NEXT_PUBLIC_AUDITOR_URL?.replace(/\/$/, '') ??
  'http://127.0.0.1:8000';

export async function GET() {
  try {
    const response = await fetch(`${AUDITOR_URL}/health`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json(
        { ok: false, error: `Auditor respondió ${response.status}: ${text}` },
        { status: response.status },
      );
    }
    const payload = await response.json();
    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
