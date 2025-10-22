// apps/dashboard/lib/integrations.ts
const API = process.env.NEXT_PUBLIC_AUDITOR_URL || 'http://127.0.0.1:8000';
export async function integrationsStatus(site: string) {
  const r = await fetch(`${API}/integrations/status?site=${encodeURIComponent(site)}`, { cache:'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ga4:boolean,gsc:boolean}>;
}
