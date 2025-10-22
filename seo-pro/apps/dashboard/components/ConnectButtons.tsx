'use client';

import { useState } from 'react';

type Provider = 'ga4' | 'gsc';

export function ConnectButtons({ site }: { site: string }) {
  const [loading, setLoading] = useState<Provider | null>(null);

  async function connect(provider: Provider) {
    setLoading(provider);
    try {
      const params = new URLSearchParams({ provider, site });
      const response = await fetch(`/api/oauth/google/start?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        const message =
          (errorPayload && errorPayload.error) ||
          `Auditor respondió ${response.status}`;
        throw new Error(message);
      }

      const payload = (await response.json()) as { auth_url?: string; error?: string };
      if (payload.auth_url) {
        window.location.href = payload.auth_url;
      } else {
        throw new Error(payload.error ?? 'Respuesta inesperada del auditor.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Error conectando ${provider.toUpperCase()}: ${message}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => connect('ga4')}
        className="rounded-xl border px-3 py-2 text-sm"
        disabled={loading !== null}
      >
        {loading === 'ga4' ? 'Conectando GA4…' : 'Conectar GA4'}
      </button>
      <button
        onClick={() => connect('gsc')}
        className="rounded-xl border px-3 py-2 text-sm"
        disabled={loading !== null}
      >
        {loading === 'gsc' ? 'Conectando GSC…' : 'Conectar GSC'}
      </button>
    </div>
  );
}
