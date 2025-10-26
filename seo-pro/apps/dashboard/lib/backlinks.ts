import { stringify } from 'querystring';

export type BacklinkEvent = {
  id: number;
  backlink_id: number;
  event_type: string;
  event_at: string;
  diff?: Record<string, unknown> | null;
};

export type BacklinkRecord = {
  id: number;
  source_page_id: number;
  source_url: string;
  source_title: string | null;
  source_lang: string | null;
  source_country: string | null;
  target_url: string;
  rel: string;
  anchor: string | null;
  context_snippet: string | null;
  status: string;
  status_code: number | null;
  authority: number;
  toxicity: number;
  first_seen: string;
  last_seen: string;
  latest_event?: BacklinkEvent | null;
};

export type BacklinkList = {
  items: BacklinkRecord[];
  total: number;
  page: number;
  page_size: number;
};

export type BacklinkKpis = {
  total_backlinks: number;
  referring_domains: number;
  new_7: number;
  new_30: number;
  lost_7: number;
  lost_30: number;
  follow_ratio: number;
  toxicity_avg: number;
};

export type BacklinkSeriesPoint = {
  date: string;
  new: number;
  lost: number;
};

export type BacklinkFilters = {
  project_id: number;
  domain?: string;
  status?: string;
  rel?: string;
  min_auth?: number;
  tox_max?: number;
  q?: string;
  page?: number;
  page_size?: number;
  language?: string;
  country?: string;
  status_code?: number;
  anchor_regex?: string;
  since?: string;
  until?: string;
};

async function fetchBacklinks<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backlinks${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Backlinks API error (${response.status}): ${message}`);
  }

  return response.json() as Promise<T>;
}

export async function getBacklinkKpis(projectId: number): Promise<BacklinkKpis> {
  return fetchBacklinks(`/backlinks/kpis?project_id=${projectId}`);
}

export async function getBacklinkEvents(projectId: number): Promise<BacklinkEvent[]> {
  return fetchBacklinks(`/backlinks/events?project_id=${projectId}`);
}

export async function getBacklinkSeries(projectId: number, start: string, end: string): Promise<BacklinkSeriesPoint[]> {
  const params = new URLSearchParams({ project_id: String(projectId), start, end });
  return fetchBacklinks(`/backlinks/series?${params.toString()}`);
}

export async function getBacklinkList(filters: BacklinkFilters): Promise<BacklinkList> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  return fetchBacklinks(`/backlinks?${params.toString()}`);
}

export async function downloadBacklinksCsv(filters: BacklinkFilters): Promise<Blob> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  const response = await fetch(`/api/backlinks/export/backlinks.csv?${params.toString()}`, {
    headers: { accept: 'text/csv' },
    cache: 'no-store',
  });
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`No se pudo generar el CSV (${response.status}): ${message}`);
  }
  return response.blob();
}

export async function downloadDisavow(filters: BacklinkFilters): Promise<Blob> {
  const response = await fetch('/api/backlinks/disavow/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ project_id: filters.project_id, filters }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`No se pudo generar el disavow (${response.status}): ${message}`);
  }
  return response.blob();
}
