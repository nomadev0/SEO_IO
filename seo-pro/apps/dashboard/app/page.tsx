'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  health,
  runDiagnostic,
  type AnalyzePage,
  type AuditResponse,
  type DiagnosticResponse,
  type PsiResponse,
  type Severity,
} from '../lib/api';
import { NavSidebar } from '../components/NavSidebar';
import IssuesTable from '../components/IssuesTable';
import { SeverityPie, TopHeavyBar, SparkArea, RadialGauge, HorizontalBar } from '../components/Charts';
import { ConnectButtons } from '../components/ConnectButtons';

const SEVERITY_ORDER: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'n/d';
  }
  return Number(value).toLocaleString('es-ES');
}

function formatDateLabel(value: string): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }
  return value;
}

export default function DashboardPage() {
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  const [targetUrl, setTargetUrl] = useState('https://example.com');
  const [keywords, setKeywords] = useState('');
  const [maxUrls, setMaxUrls] = useState(80);
  const [psiStrategy, setPsiStrategy] = useState<'mobile' | 'desktop'>('mobile');

  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);
  const [pageAnalysis, setPageAnalysis] = useState<AnalyzePage | null>(null);
  const [psiResult, setPsiResult] = useState<PsiResponse | null>(null);
  const [ga4Summary, setGa4Summary] = useState<Record<string, any> | null>(null);
  const [gscSummary, setGscSummary] = useState<Record<string, any> | null>(null);
  const [rankingSummary, setRankingSummary] = useState<Record<string, any> | null>(null);
  const [backlinkSummary, setBacklinkSummary] = useState<Record<string, any> | null>(null);

  const [serviceNotice, setServiceNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    health()
      .then(() => {
        setApiUp(true);
        setServiceNotice(null);
      })
      .catch((err) => {
        setApiUp(false);
        const message =
          err instanceof Error
            ? err.message
            : 'No se pudo contactar con el servicio auditor en http://127.0.0.1:8000. Asegurate de que este ejecutandose.';
        setServiceNotice(message);
      });
  }, []);

  const auditCounts = useMemo(() => {
    const counts = new Map<Severity, number>();
    SEVERITY_ORDER.forEach((severity) => counts.set(severity, 0));
    auditResult?.issues.forEach((issue) => {
      counts.set(issue.severity, (counts.get(issue.severity) ?? 0) + 1);
    });
    return SEVERITY_ORDER.map((severity) => ({ name: severity, value: counts.get(severity) ?? 0 }));
  }, [auditResult]);

  const siteHealthScore = useMemo(() => {
    if (!auditResult) return null;
    const total = auditResult.count;
    if (total === 0) return 100;
    const critical = auditCounts.find((item) => item.name === 'Critical')?.value ?? 0;
    const penalty = Math.min(95, critical * 15 + total * 4);
    return Math.max(0, 100 - penalty);
  }, [auditCounts, auditResult]);

  const [hostname, siteOrigin] = useMemo(() => {
    try {
      const parsed = new URL(targetUrl);
      return [parsed.hostname, parsed.origin];
    } catch {
      const cleaned = targetUrl.replace(/^https?:\/\//, '');
      return [cleaned, `https://${cleaned}`];
    }
  }, [targetUrl]);

  const gaData = ga4Summary as Record<string, any> | null;
  const gaAvailable = Boolean(gaData && gaData.available !== false);
  const gaTotals = gaAvailable ? (gaData?.totals ?? {}) : {};
  const gaTimeseries = useMemo(() => {
    if (!gaAvailable) return [] as { date: string; label: string; users: number; sessions: number; views: number }[];
    return (gaData?.timeseries ?? []).map((point: any) => ({
      date: point.date,
      label: formatDateLabel(point.date),
      users: Number(point.users ?? 0),
      sessions: Number(point.sessions ?? 0),
      views: Number(point.views ?? 0),
    }));
  }, [gaAvailable, gaData]);

  const gscData = gscSummary as Record<string, any> | null;
  const gscAvailable = Boolean(gscData && gscData.available !== false);
  const gscClicks = gscAvailable ? Number(gscData?.clicks ?? 0) : null;
  const gscImpressions = gscAvailable ? Number(gscData?.impressions ?? 0) : null;
  const gscCtrPercent = gscAvailable ? Math.round((gscData?.ctr ?? 0) * 100) : null;
  const gscAvgPosition =
    gscAvailable && gscData?.avg_position !== undefined ? Number(gscData.avg_position) : null;
  const gscWindow =
    gscAvailable && gscData?.start_date && gscData?.end_date
      ? `${gscData.start_date} -> ${gscData.end_date}`
      : null;
  const gscTopQueries = gscAvailable
    ? (gscData?.top_queries ?? []).map((row: any) => ({
        query: row.query || 'n/d',
        clicks: Number(row.clicks ?? 0),
        impressions: Number(row.impressions ?? 0),
        ctr: Number(row.ctr ?? 0),
      }))
    : [];

  const heavyResources = psiResult?.heavy_requests.length ?? 0;
  const totalRecommendations = pageAnalysis?.recommendations.length ?? 0;
  const totalKeywords = Object.keys(pageAnalysis?.keyword_hits ?? {}).length;

  async function handleFullDiagnostic() {
    setDiagnosticLoading(true);
    setError(null);
    setNotice(null);
    setGa4Summary(null);
    setGscSummary(null);
    setRankingSummary(null);
    setBacklinkSummary(null);
    try {
      const result: DiagnosticResponse = await runDiagnostic({
        targetUrl,
        keywords,
        maxUrls,
        psiStrategy,
        siteHost: siteOrigin,
      });

      const errors: string[] = [];
      if (result.audit.ok && result.audit.data) {
        setAuditResult(result.audit.data);
      } else {
        setAuditResult(null);
        errors.push(`Auditoria: ${result.audit.error ?? 'sin detalle'}`);
      }

      if (result.analysis.ok && result.analysis.data) {
        setPageAnalysis(result.analysis.data);
      } else {
        setPageAnalysis(null);
        errors.push(`On-page: ${result.analysis.error ?? 'sin detalle'}`);
      }

      if (result.psi.ok && result.psi.data) {
        setPsiResult(result.psi.data);
      } else {
        setPsiResult(null);
        errors.push(`PageSpeed: ${result.psi.error ?? 'sin detalle'}`);
      }

      setGa4Summary(result.ga4 ?? null);
      setGscSummary(result.gsc ?? null);
      setRankingSummary(result.rankings ?? null);
      setBacklinkSummary(result.backlinks ?? null);

      const notices: string[] = [];
      const ga4 = result.ga4 as Record<string, any> | undefined;
      if (ga4 && ga4.available === false && ga4.reason) {
        notices.push(`GA4: ${ga4.reason}`);
      }
      const gsc = result.gsc as Record<string, any> | undefined;
      if (gsc && gsc.available === false && gsc.reason) {
        notices.push(`GSC: ${gsc.reason}`);
      }
      const rankings = result.rankings as Record<string, any> | undefined;
      if (rankings && rankings.available === false && rankings.reason) {
        notices.push(`Rank tracking: ${rankings.reason}`);
      }
      const backlinks = result.backlinks as Record<string, any> | undefined;
      if (backlinks && backlinks.available === false && backlinks.reason) {
        notices.push(`Backlinks: ${backlinks.reason}`);
      }

      if (errors.length > 0) {
        setError(errors.join(' | '));
      } else {
        setError(null);
      }
      setNotice(notices.length > 0 ? notices.join(' | ') : null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron obtener los datos. Verifica la URL e intenta de nuevo.',
      );
    } finally {
      setDiagnosticLoading(false);
    }
  }

  const gaUsersValue = gaAvailable ? formatNumber(gaTotals.users ?? null) : 'n/d';
  const gaSessionsValue = gaAvailable ? formatNumber(gaTotals.sessions ?? null) : 'n/d';
  const gaViewsValue = gaAvailable ? formatNumber(gaTotals.views ?? null) : 'n/d';

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-neutral-100 via-white to-neutral-200">
      <NavSidebar />
      <div className="flex flex-1 flex-col">
        <header className="px-6 py-6">
          <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-800 p-8 text-white shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-indigo-200">Panel de SEO</p>
                <h1 className="text-3xl font-semibold">{hostname}</h1>
                <p className="text-sm text-indigo-100">
                  Alcance: dominio raiz . {apiUp === false ? 'API desconectada' : 'API lista'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ConnectButtons site={siteOrigin} />
                <button className="rounded-full border border-white/30 px-5 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10">
                  Exportar informe
                </button>
                <button className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-indigo-900 shadow hover:bg-indigo-100">
                  Crear proyecto SEO
                </button>
              </div>
            </div>

            <form
              className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-6"
              onSubmit={(event) => {
                event.preventDefault();
                void handleFullDiagnostic();
              }}
            >
              <label className="lg:col-span-3">
                <span className="text-xs uppercase tracking-wide text-indigo-200">URL objetivo</span>
                <input
                  value={targetUrl}
                  onChange={(event) => setTargetUrl(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm placeholder:text-white/60 focus:border-white focus:outline-none"
                  placeholder="https://tu-dominio.com"
                  required
                />
              </label>
              <label className="lg:col-span-2">
                <span className="text-xs uppercase tracking-wide text-indigo-200">Keywords objetivo</span>
                <input
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm placeholder:text-white/60 focus:border-white focus:outline-none"
                  placeholder="keyword principal, marca"
                />
              </label>
              <div className="lg:col-span-1 flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
                <div className="w-full">
                  <span className="text-xs uppercase tracking-wide text-indigo-200">Max. URLs</span>
                  <input
                    type="number"
                    value={maxUrls}
                    min={20}
                    max={500}
                    onChange={(event) => setMaxUrls(Number(event.target.value) || maxUrls)}
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
                  />
                </div>
                <div className="w-full">
                  <span className="text-xs uppercase tracking-wide text-indigo-200">Estrategia PSI</span>
                  <select
                    value={psiStrategy}
                    onChange={(event) => setPsiStrategy(event.target.value as 'mobile' | 'desktop')}
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
                  >
                    <option value="mobile">Mobile</option>
                    <option value="desktop">Desktop</option>
                  </select>
                </div>
              </div>
              <div className="flex items-end justify-end gap-3 lg:col-span-6">
                <button
                  type="button"
                  onClick={() => {
                    setTargetUrl('https://example.com');
                    setKeywords('');
                    setAuditResult(null);
                    setPageAnalysis(null);
                    setPsiResult(null);
                    setGa4Summary(null);
                    setGscSummary(null);
                    setRankingSummary(null);
                    setBacklinkSummary(null);
                    setError(null);
                    setNotice(null);
                  }}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={diagnosticLoading}
                  className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-indigo-900 shadow-lg transition hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-70"
                >
                  {diagnosticLoading ? 'Diagnosticando...' : 'Lanzar diagnostico completo'}
                </button>
              </div>
            </form>
          </div>
        </header>

        <main className="flex-1 space-y-8 px-6 pb-10">
          {serviceNotice ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 shadow">
              {serviceNotice}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 shadow">
              {notice}
            </div>
          ) : null}

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Usuarios (GA4)</p>
                  <p className="mt-2 text-3xl font-semibold text-neutral-900">{gaUsersValue}</p>
                  <p className="text-xs text-neutral-500">Total ultimos 28 dias</p>
                </div>
                <div className="h-24 w-36">
                  {gaTimeseries.length > 0 ? (
                    <SparkArea data={gaTimeseries} dataKey="users" gradientFrom="#a855f7" gradientTo="rgba(168,85,247,0)" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-neutral-400">sin datos</div>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Sesiones (GA4)</p>
                  <p className="mt-2 text-3xl font-semibold text-neutral-900">{gaSessionsValue}</p>
                  <p className="text-xs text-neutral-500">Ultimos 28 dias</p>
                </div>
                <div className="h-24 w-36">
                  {gaTimeseries.length > 0 ? (
                    <SparkArea data={gaTimeseries} dataKey="sessions" gradientFrom="#6366f1" gradientTo="rgba(99,102,241,0)" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-neutral-400">sin datos</div>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Vistas (GA4)</p>
                  <p className="mt-2 text-3xl font-semibold text-neutral-900">{gaViewsValue}</p>
                  <p className="text-xs text-neutral-500">Ultimos 28 dias</p>
                </div>
                <div className="h-24 w-36">
                  {gaTimeseries.length > 0 ? (
                    <SparkArea data={gaTimeseries} dataKey="views" gradientFrom="#f97316" gradientTo="rgba(249,115,22,0)" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-neutral-400">sin datos</div>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">CTR organico (GSC)</p>
                  <p className="text-xs text-neutral-500">{gscWindow ?? 'Ventana no definida'}</p>
                </div>
                <RadialGauge value={gscCtrPercent ?? 0} max={100} label="CTR" color="#22c55e" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-neutral-600">
                <div className="rounded-lg bg-neutral-100 px-3 py-2">
                  <p className="text-xs text-neutral-500">Clicks</p>
                  <p className="text-lg font-semibold text-neutral-900">{formatNumber(gscClicks)}</p>
                </div>
                <div className="rounded-lg bg-neutral-100 px-3 py-2">
                  <p className="text-xs text-neutral-500">Impresiones</p>
                  <p className="text-lg font-semibold text-neutral-900">{formatNumber(gscImpressions)}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-800">Consultas principales (GSC)</h2>
                  <p className="text-xs text-neutral-500">Ordenadas por clics.</p>
                </div>
              </div>
              {gscTopQueries.length > 0 ? (
                <div className="mt-4">
                  <HorizontalBar data={gscTopQueries.slice(0, 6)} dataKey="clicks" categoryKey="query" color="#fb923c" />
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-500">
                  Aun no hay consultas registradas. Conecta Search Console y ejecuta el diagnostico.
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-800">Resumen GA4</h2>
                  <p className="text-xs text-neutral-500">Usuarios, sesiones y vistas totales.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-neutral-600 md:grid-cols-3">
                <div className="rounded-lg bg-neutral-100 px-3 py-2">
                  <p className="text-xs text-neutral-500">Usuarios</p>
                  <p className="text-lg font-semibold text-neutral-900">{gaUsersValue}</p>
                </div>
                <div className="rounded-lg bg-neutral-100 px-3 py-2">
                  <p className="text-xs text-neutral-500">Sesiones</p>
                  <p className="text-lg font-semibold text-neutral-900">{gaSessionsValue}</p>
                </div>
                <div className="rounded-lg bg-neutral-100 px-3 py-2">
                  <p className="text-xs text-neutral-500">Vistas</p>
                  <p className="text-lg font-semibold text-neutral-900">{gaViewsValue}</p>
                </div>
              </div>
              <div className="mt-6">
                <h3 className="text-xs uppercase tracking-wide text-neutral-400">Tendencia diaria</h3>
                <div className="mt-3 h-32 w-full">
                  {gaTimeseries.length > 0 ? (
                    <SparkArea data={gaTimeseries} dataKey="sessions" gradientFrom="#0ea5e9" gradientTo="rgba(14,165,233,0)" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-neutral-400">sin datos</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-800">Distribucion de severidad</h2>
              <p className="text-xs text-neutral-500">Breakdown de issues detectados por el crawler.</p>
              <div className="mt-4">
                <SeverityPie data={auditCounts} />
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-800">Recursos mas pesados (PSI)</h2>
              <p className="text-xs text-neutral-500">Top solicitudes por peso transferido.</p>
              {psiResult && heavyResources > 0 ? (
                <div className="mt-4">
                  <TopHeavyBar items={psiResult.heavy_requests} />
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-500">
                  Ejecuta la consulta PSI para ver los recursos mas pesados.
                </div>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-800">Auditoria tecnica</h2>
                  <p className="text-xs text-neutral-500">Resultados del crawler sobre el dominio.</p>
                </div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-500">
                  {auditResult ? `${auditResult.scanned} paginas` : 'Sin datos'}
                </span>
              </div>
              <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                {auditResult ? (
                  <div className="flex flex-wrap gap-6">
                    <span>Issues totales: <strong>{auditResult.count}</strong></span>
                    <span>Paginas rastreadas: <strong>{auditResult.scanned}</strong></span>
                    {siteHealthScore !== null ? (
                      <span>Site health: <strong>{siteHealthScore}</strong></span>
                    ) : null}
                  </div>
                ) : (
                  'Ejecuta el diagnostico para ver el detalle del crawl.'
                )}
              </div>
              <div className="mt-6">
                {auditResult ? (
                  <IssuesTable issues={auditResult.issues} />
                ) : (
                  <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
                    Aun no hay resultados. Ejecuta la auditoria para listar issues.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-neutral-800">On Page SEO Checker</h2>
                <p className="text-xs text-neutral-500">Resumen de la pagina analizada y recomendaciones.</p>
                {pageAnalysis ? (
                  <div className="mt-4 space-y-3 text-sm text-neutral-700">
                    <div>
                      <span className="text-xs uppercase text-neutral-400">Title</span>
                      <p className="font-medium text-neutral-900">{pageAnalysis.title || 'Sin title'}</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase text-neutral-400">Meta description</span>
                      <p className="text-neutral-900">{pageAnalysis.meta_description || 'Sin description'}</p>
                    </div>
                    <div className="rounded-lg bg-neutral-100 px-3 py-2 text-xs">
                      {totalRecommendations > 0
                        ? `${totalRecommendations} ideas detectadas.`
                        : 'No se detectaron incidencias relevantes.'}
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
                      <p className="font-semibold text-neutral-500">Cobertura de keywords:</p>
                      {Object.entries(pageAnalysis.keyword_hits).map(([keyword, hits]) => (
                        <div key={keyword} className="mt-1">
                          {keyword}: {hits > 0 ? `${hits} coincidencia(s)` : 'sin coincidencias'}
                        </div>
                      ))}
                      {totalKeywords === 0 && <p>Sin keywords objetivo configuradas.</p>}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-neutral-500">
                    El diagnostico ejecutara automaticamente el analisis on-page y mostrara los resultados aqui.
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-neutral-800">PageSpeed Insights</h2>
                <p className="text-xs text-neutral-500">Metricas de rendimiento de la URL objetivo.</p>
                {psiResult ? (
                  <div className="mt-4 space-y-2 text-sm text-neutral-700">
                    <div className="flex items-center justify-between">
                      <span>Performance</span>
                      <span className="font-semibold text-neutral-900">{psiResult.performance_score ?? 'n/d'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(psiResult.metrics).map(([metric, value]) => (
                        <div key={metric} className="rounded-lg bg-neutral-100 px-3 py-2">
                          <div className="text-neutral-500">{metric}</div>
                          <div className="font-semibold text-neutral-800">{value !== null ? Math.round(value) : 'n/d'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-neutral-500">
                    El diagnostico lanzara automaticamente la consulta PageSpeed y mostrara las metricas aqui.
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
