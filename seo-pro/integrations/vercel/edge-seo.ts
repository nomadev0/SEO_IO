import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  // En staging, forzar noindex por cabecera (evita olvidos)
  if (process.env.VERCEL_ENV !== 'production') {
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }
  // Canonical host (www)
  const host = req.headers.get('host') || '';
  if (host && !host.startsWith('www.')) {
    url.host = `www.${host}`;
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|api|static).*)'] };