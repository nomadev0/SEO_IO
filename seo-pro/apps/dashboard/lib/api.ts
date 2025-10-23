const AUDITOR_BASE =
  process.env.NEXT_PUBLIC_AUDITOR_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:8000';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export type Issue = {
  url: string;
  rule: string;
  severity: Severity;
  description: string;
  evidence: Record<string, unknown>;
};

export type AuditResponse = {
  base_url?: string;
  scanned: number;
  count: number;
  duration_ms?: number;
  issues: Issue[];
};

export type AnalyzePage = {
  url: string;
  title: string;
  title_length: number;
  meta_description: string;
  meta_description_length: number;
  canonical: string | null;
  robots_meta: string | null;
  headings: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number };
  media: { images: number; images_missing_alt: number; videos: number };
  word_count: number;
  keyword_score: number;
  keyword_hits: Record<string, number>;
  recommendations: string[];
  link_stats: { internal: number; external: number; nofollow: number };
  readability_score: number;
  reading_time_seconds: number;
};

export type PsiResponse = {
  url: string;
  strategy: 'mobile' | 'desktop';
  uses_api_key?: boolean;
  performance_score: number | null;
  metrics: Record<string, number | null>;
  heavy_requests: { url: string; transfer: number; resourceType?: string }[];
};

export type DiagnosticRequest = {
  targetUrl: string;
  keywords: string;
  maxUrls: number;
  psiStrategy: 'mobile' | 'desktop';
  siteHost: string;
  gscProperty?: string;
  serpKeyword?: string;
  serpLocation?: string;
};

export type ServiceResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export type DiagnosticResponse = {
  audit: ServiceResult<AuditResponse>;
  analysis: ServiceResult<AnalyzePage>;
  psi: ServiceResult<PsiResponse>;
  ga4?: Record<string, unknown>;
  gsc?: Record<string, unknown>;
  rankings?: Record<string, unknown>;
  backlinks?: Record<string, unknown>;
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(input, {
      ...init,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Request failed (${response.status}): ${text}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Fallo de red desconocido con el servicio auditor.';
    throw new Error(`No se pudo contactar con el servicio. Detalle: ${message}`);
  }
}

export async function health(): Promise<void> {
  await fetchJson('/api/auditor/health');
}

export async function runDiagnostic(payload: DiagnosticRequest): Promise<DiagnosticResponse> {
  return fetchJson<DiagnosticResponse>('/api/diagnostic', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Utilidad opcional: ping directo al servicio (útil para debug en CLI)
export async function pingAuditorDirect(): Promise<void> {
  await fetchJson(`${AUDITOR_BASE}/health`, { headers: { accept: 'application/json' } });
}
