import { NextRequest, NextResponse } from "next/server";

const BACKLINKS_BASE = (process.env.BACKLINKS_URL ?? process.env.NEXT_PUBLIC_BACKLINKS_URL ?? 'http://127.0.0.1:8100').replace(/\/$/, '');
const BACKLINKS_TOKEN = process.env.BACKLINKS_TOKEN ?? process.env.NEXT_PUBLIC_BACKLINKS_TOKEN ?? 'devtoken-backlinks';

type Params = { params: { path: string[] } };

async function proxy(request: NextRequest, method: string, { params }: Params) {
  const targetPath = params.path.join('/');
  const url = `${BACKLINKS_BASE}/${targetPath}${request.nextUrl.search}`;

  const headers: Record<string, string> = {
    accept: request.headers.get('accept') ?? 'application/json',
    authorization: `Bearer ${BACKLINKS_TOKEN}`,
  };

  if (method !== 'GET' && method !== 'HEAD') {
    const contentType = request.headers.get('content-type');
    if (contentType) {
      headers['content-type'] = contentType;
    }
  }

  const init: RequestInit = {
    method,
    headers,
    cache: 'no-store',
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await request.text();
  }

  try {
    const response = await fetch(url, init);
    const body = await response.text();
    const contentType = response.headers.get('content-type') ?? headers.accept ?? 'application/json';
    return new NextResponse(body, {
      status: response.status,
      headers: {
        'content-type': contentType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ detail: `Backlinks service unreachable: ${message}` }, { status: 502 });
  }
}

export async function GET(request: NextRequest, context: Params) {
  return proxy(request, 'GET', context);
}

export async function POST(request: NextRequest, context: Params) {
  return proxy(request, 'POST', context);
}

export async function PUT(request: NextRequest, context: Params) {
  return proxy(request, 'PUT', context);
}

export async function DELETE(request: NextRequest, context: Params) {
  return proxy(request, 'DELETE', context);
}
