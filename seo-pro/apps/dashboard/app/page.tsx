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
import { OverviewCard } from '../components/OverviewCard';
import { NavSidebar } from '../components/NavSidebar';
import { ScoreGauge } from '../components/ScoreGauge';
import IssuesTable from '../components/IssuesTable';
import { MetricCard } from '../components/MetricCard';
import { SeverityPie, TopHeavyBar } from '../components/Charts';
import { ConnectButtons } from '../components/ConnectButtons';

const SEVERITY_ORDER: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

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
            : 'No se pudo contactar con el servicio auditor en http://127.0.0.1:8000. Asegrate de que est ejecutndose.';
        setServiceNotice(message);
      });
  }, []);

  const auditCounts = useMemo(() => {
    const counts = new Map<Severity, number>();
    SEVERITY_ORDER.forEach((severity) => counts.set(severity, 0));
    auditResult?.issues.forEach((issue) => {
      counts.set(issue.severity, (counts.get(issue.severity) ?? 0) + 1);
    });
    return SEVERITY_ORDER.map((severity) => ({
      name: severity,
      value: counts.get(severity) ?? 0,
    }));
  }, [auditResult]);

  const siteHealthScore = useMemo(() => {
    if (!auditResult) return null;
    const total = auditResult.count;
    if (total === 0) return 100;
    const critical = auditCounts.find((item) => item.name === 'Critical')?.value ?? 0;
    const penalty = Math.min(95, critical * 15 + total * 4);
    return Math.max(0, 100 - penalty);
  }, [auditCounts, auditResult]);

  const totalRecommendations = pageAnalysis?.recommendations.length ?? 0;
  const totalKeywords = Object.keys(pageAnalysis?.keyword_hits ?? {}).length;
  const heavyResources = psiResult?.heavy_requests.length ?? 0;

  const gscData = gscSummary as Record<string, any> | null;
  const gscAvailable =
    gscData && Object.prototype.hasOwnProperty.call(gscData, 'available')
      ? gscData.available !== false
      : false;
  const gscClicks =
    gscAvailable && typeof gscData?.clicks === 'number' ? gscData.clicks : null;
  const gscImpressions =
    gscAvailable && typeof gscData?.impressions === 'number'
      ? gscData.impressions
      : null;
  const gscCtr =
    gscAvailable && typeof gscData?.ctr === 'number' ? gscData.ctr : null;
  const gscAvgPosition =
    gscAvailable && typeof gscData?.avg_position === 'number'
      ? gscData.avg_position
      : null;
  const gscWindow =
    gscAvailable && gscData?.start_date && gscData?.end_date
      ? `${gscData.start_date} → ${gscData.end_date}`
      : null;

  const rankingData = rankingSummary as Record<string, any> | null;
  const rankingAvailable =
    rankingData && Object.prototype.hasOwnProperty.call(rankingData, 'available')
      ? rankingData.available !== false
      : false;
  const rankingPosition =
    rankingAvailable && typeof rankingData?.position === 'number'
      ? rankingData.position
      : null;
  const rankingKeyword = rankingAvailable ? rankingData?.keyword : null;
  const rankingSerp: Array<Record<string, any>> =
    rankingAvailable && Array.isArray(rankingData?.serp_sample)
      ? (rankingData?.serp_sample as Array<Record<string, any>>)
      : [];

  const backlinkData = backlinkSummary as Record<string, any> | null;
  const backlinkAvailable =
    backlinkData && Object.prototype.hasOwnProperty.call(backlinkData, 'available')
      ? backlinkData.available !== false
      : false;
  const domainRating =
    backlinkAvailable && typeof backlinkData?.domain_rating === 'number'
      ? backlinkData.domain_rating
      : null;

  const hostname = useMemo(() => {
    try {
      return new URL(targetUrl).hostname;
    } catch {
      return targetUrl.replace(/^https?:\/\//, '');
    }
  }, [targetUrl]);

  const siteOrigin = useMemo(() => {
    try {
      return new URL(targetUrl).origin;
    } catch {
      return `https://${hostname}`;
    }
  }, [targetUrl, hostname]);

  async function handleFullDiagnostic() {
    setDiagnosticLoading(true);
    setError(null);
    setNotice(null);
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
        errors.push(`Auditoría: ${result.audit.error ?? 'sin detalle'}`);
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

      setGscSummary(result.gsc ?? null);
      setRankingSummary(result.rankings ?? null);
      setBacklinkSummary(result.backlinks ?? null);

      const notices: string[] = [];
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

  return (
    <div className="flex min-h-screen bg-neutral-100">
      <NavSidebar />
      <div className="flex flex-1 flex-col">
        <header className="border-b border-neutral-200 bg-white px-6 py-5">
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-neutral-500">Panel de SEO</p>
                <h1 className="text-2xl font-semibold text-neutral-900">{hostname}</h1>
                <p className="text-sm text-neutral-500">
                  Alcance: dominio raíz · {apiUp === false ? 'API desconectada' : 'API lista'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ConnectButtons site={siteOrigin} />
                <button className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
                  Exportar informe
                </button>
                <button className="rounded-full bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800">
                  Crear proyecto SEO
                </button>
              </div>
            </div>

            <form
              className="grid grid-cols-1 gap-3 md:grid-cols-5"
              onSubmit={(event) => {
                event.preventDefault();
                void handleFullDiagnostic();
              }}
            >
              <label className="md:col-span-3">
                <span className="text-xs uppercase text-neutral-500">URL objetivo</span>
                <input
                  value={targetUrl}
                  onChange={(event) => setTargetUrl(event.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  placeholder="https://tu-dominio.com"
                  required
                />
              </label>
              <label className="md:col-span-2">
                <span className="text-xs uppercase text-neutral-500">Keywords objetivo</span>
                <input
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  placeholder="keyword principal, marca"
                />
              </label>
              <div className="md:col-span-5 flex flex-wrap items-center gap-3">
                <label className="text-xs uppercase text-neutral-500">
                  Máx. URLs
                  <input
                    type="number"
                    value={maxUrls}
                    min={20}
                    max={500}
                    onChange={(event) => setMaxUrls(Number(event.target.value) || maxUrls)}
                    className="mt-1 w-24 rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="text-xs uppercase text-neutral-500">
                  Estrategia PSI
                  <select
                    value={psiStrategy}
                    onChange={(event) => setPsiStrategy(event.target.value as 'mobile' | 'desktop')}
                    className="mt-1 w-32 rounded-lg border px-3 py-2"
                  >
                    <option value="mobile">Mobile</option>
                    <option value="desktop">Desktop</option>
                  </select>
                </label>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                  onClick={() => {
                      setTargetUrl('https://example.com');
                      setKeywords('');
                      setAuditResult(null);
                      setPageAnalysis(null);
                      setPsiResult(null);
                      setGscSummary(null);
                      setRankingSummary(null);
                      setBacklinkSummary(null);
                      setError(null);
                      setNotice(null);
                    }}
                    className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={diagnosticLoading}
                    className="rounded-full bg-black px-5 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {diagnosticLoading ? 'Diagnosticando...' : 'Lanzar diagnóstico completo'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {serviceNotice ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {serviceNotice}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                {notice}
              </div>
            ) : null}

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OverviewCard
                title="Clics orgánicos (GSC)"
                value={gscClicks ?? 'n/d'}
                hint={gscAvailable ? `Ventana ${gscWindow}` : 'Configura GSC para obtener datos reales.'}
              />
              <OverviewCard
                title="Impresiones (GSC)"
                value={gscImpressions ?? 'n/d'}
                hint={gscAvailable ? `Ventana ${gscWindow}` : 'Resultado estimado.'}
              />
              <OverviewCard
                title="CTR orgánico"
                value={gscCtr !== null ? `${(gscCtr * 100).toFixed(2)}%` : 'n/d'}
                hint={gscAvailable ? 'Clicks / Impresiones en GSC.' : 'Ejecuta el diagnóstico con GSC configurado.'}
              />
              <OverviewCard
                title="Authority Score"
                value={siteHealthScore !== null ? siteHealthScore : 'n/d'}
                hint="Penaliza issues críticos y advertencias detectadas."
              />
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm xl:col-span-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-800">Search Console</h2>
                    <p className="text-xs text-neutral-500">
                      Clics, impresiones y mejores consultas del intervalo seleccionado.
                    </p>
                  </div>
                  {gscWindow ? (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      {gscWindow}
                    </span>
                  ) : null}
                </div>
                {gscAvailable ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm text-neutral-700">
                      <div className="rounded-lg bg-neutral-100 px-3 py-2">
                        <p className="text-xs text-neutral-500">Clicks</p>
                        <p className="text-lg font-semibold">{gscClicks?.toLocaleString('es-ES')}</p>
                      </div>
                      <div className="rounded-lg bg-neutral-100 px-3 py-2">
                        <p className="text-xs text-neutral-500">Impresiones</p>
                        <p className="text-lg font-semibold">
                          {gscImpressions?.toLocaleString('es-ES')}
                        </p>
                      </div>
                      <div className="rounded-lg bg-neutral-100 px-3 py-2">
                        <p className="text-xs text-neutral-500">CTR</p>
                        <p className="text-lg font-semibold">
                          {gscCtr !== null ? `${(gscCtr * 100).toFixed(2)}%` : 'n/d'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-neutral-100 px-3 py-2">
                        <p className="text-xs text-neutral-500">Posición media</p>
                        <p className="text-lg font-semibold">
                          {gscAvgPosition !== null ? gscAvgPosition.toFixed(1) : 'n/d'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                        Principales consultas
                      </h3>
                      <div className="mt-2 overflow-auto rounded-lg border border-neutral-200">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                            <tr>
                              <th className="px-3 py-2">Consulta</th>
                              <th className="px-3 py-2">Clicks</th>
                              <th className="px-3 py-2">Impresiones</th>
                              <th className="px-3 py-2">CTR</th>
                              <th className="px-3 py-2">Posición</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(gscData?.top_queries as Array<Record<string, any>> | undefined)?.slice(0, 8).map(
                              (row, index) => (
                                <tr key={`${row.query}-${index}`} className="border-t">
                                  <td className="px-3 py-2">{row.query || 'n/d'}</td>
                                  <td className="px-3 py-2">{Math.round(row.clicks ?? 0)}</td>
                                  <td className="px-3 py-2">{Math.round(row.impressions ?? 0)}</td>
                                  <td className="px-3 py-2">
                                    {row.ctr !== undefined ? `${(row.ctr * 100).toFixed(2)}%` : 'n/d'}
                                  </td>
                                  <td className="px-3 py-2">
                                    {row.position !== undefined ? row.position.toFixed(1) : 'n/d'}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
                    Conecta una cuenta de Google Search Console y establece <code>GSC_SERVICE_ACCOUNT_FILE</code> o <code>GSC_SERVICE_ACCOUNT_JSON</code> para mostrar datos reales.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm xl:col-span-3">
                <h2 className="text-sm font-semibold text-neutral-800">Rank tracking</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Posición actual para la keyword objetivo en el motor configurado.
                </p>
                {rankingAvailable ? (
                  <div className="mt-4 space-y-3 text-sm text-neutral-700">
                    <div>
                      <span className="text-xs uppercase text-neutral-500">Keyword</span>
                      <div className="text-lg font-semibold text-neutral-900">{rankingKeyword}</div>
                    </div>
                    <div>
                      <span className="text-xs uppercase text-neutral-500">Posición</span>
                      <div className="text-3xl font-bold text-neutral-900">
                        {rankingPosition !== null ? `#${rankingPosition}` : 'n/d'}
                      </div>
                    </div>
                    {rankingSerp.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-neutral-500 uppercase">SERP snapshot</p>
                        <ul className="space-y-1 text-xs text-neutral-600">
                          {rankingSerp.map((entry, idx) => (
                            <li key={idx} className="flex items-center justify-between rounded-lg bg-neutral-100 px-3 py-2">
                              <span className="font-semibold text-neutral-700">#{entry.position ?? idx + 1}</span>
                              <span className="truncate text-right">{entry.title ?? entry.link}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-xs text-neutral-500">
                    Configura <code>SERP_API_KEY</code> para activar el tracking de rankings.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm xl:col-span-3">
                <h2 className="text-sm font-semibold text-neutral-800">Backlinks</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Métricas de autoridad y dominios de referencia.
                </p>
                {backlinkAvailable ? (
                  <div className="mt-4 space-y-3 text-sm text-neutral-700">
                    <div className="rounded-lg bg-neutral-100 px-3 py-2">
                      <p className="text-xs text-neutral-500">Domain Rating</p>
                      <p className="text-lg font-semibold">{domainRating ?? 'n/d'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg bg-neutral-100 px-3 py-2">
                        <p className="text-neutral-500">Backlinks</p>
                        <p className="text-neutral-900">{backlinkData?.backlinks ?? 'n/d'}</p>
                      </div>
                      <div className="rounded-lg bg-neutral-100 px-3 py-2">
                        <p className="text-neutral-500">Ref. domains</p>
                        <p className="text-neutral-900">{backlinkData?.ref_domains ?? 'n/d'}</p>
                      </div>
                      <div className="rounded-lg bg-neutral-100 px-3 py-2">
                        <p className="text-neutral-500">DoFollow</p>
                        <p className="text-neutral-900">{backlinkData?.dofollow ?? 'n/d'}</p>
                      </div>
                      <div className="rounded-lg bg-neutral-100 px-3 py-2">
                        <p className="text-neutral-500">NoFollow</p>
                        <p className="text-neutral-900">{backlinkData?.nofollow ?? 'n/d'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-xs text-neutral-500">
                    Configura <code>BACKLINK_PROVIDER</code> y <code>BACKLINK_API_KEY</code> (por ejemplo Ahrefs) para ver métricas reales.
                  </div>
                )}
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:col-span-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-800">Auditoría del sitio</h2>
                    <p className="text-xs text-neutral-500">Diagnóstico técnico automático.</p>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    {auditResult ? `${auditResult.scanned} páginas` : 'Sin datos'}
                  </span>
                </div>
                <div className="mt-6 flex justify-center">
                  <ScoreGauge score={siteHealthScore} label="Site Health" />
                </div>
                <div className="mt-6 space-y-2 text-sm text-neutral-600">
                  <div className="flex items-center justify-between">
                    <span>Errores críticos</span>
                    <span className="font-semibold text-red-600">
                      {auditCounts.find((item) => item.name === 'Critical')?.value ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Advertencias</span>
                    <span className="font-semibold text-amber-500">
                      {auditCounts.find((item) => item.name === 'High')?.value ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:col-span-8">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-800">Rastreo de posición</h2>
                    <p className="text-xs text-neutral-500">
                      Visión general de visibilidad, keywords y oportunidades.
                    </p>
                  </div>
                  <button className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100">
                    Ver informe completo
                  </button>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <MetricCard label="Visibilidad" value={auditResult ? '0.3%' : 'n/d'} />
                  <MetricCard
                    label="Keywords top 10"
                    value={totalKeywords > 0 ? Math.min(totalKeywords, 10) : 0}
                  />
                  <MetricCard
                    label="Palabra clave principal"
                    value={
                      totalKeywords > 0
                        ? Object.keys(pageAnalysis?.keyword_hits ?? {})[0] ?? 'n/d'
                        : 'n/d'
                    }
                  />
                </div>
                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-neutral-100 p-4">
                    <h3 className="text-sm font-medium text-neutral-700">Distribución por severidad</h3>
                    <div className="mt-4">
                      <SeverityPie data={auditCounts} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-neutral-100 p-4">
                    <h3 className="text-sm font-medium text-neutral-700">Ideas más recientes</h3>
                    <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                      {pageAnalysis?.recommendations.slice(0, 4).map((item, index) => (
                        <li key={index} className="rounded-lg bg-neutral-100 px-3 py-2">
                          {item}
                        </li>
                      ))}
                      {(!pageAnalysis || pageAnalysis.recommendations.length === 0) && (
                        <li className="text-neutral-500">
                          Lanza el diagnóstico para obtener sugerencias de mejora on-page.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm xl:col-span-8">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-800">Auditoría técnica</h2>
                    <p className="text-xs text-neutral-500">
                      Resultados completos del crawler sobre el dominio objetivo.
                    </p>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    {auditResult ? `${auditResult.count} issues` : 'Sin datos'}
                  </span>
                </div>
                <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-600">
                  {auditResult ? (
                    <>
                      <div>Issues totales: {auditResult.count}</div>
                      <div>Páginas rastreadas: {auditResult.scanned}</div>
                    </>
                  ) : (
                    <div>Ejecuta el diagnóstico para visualizar el listado de incidencias.</div>
                  )}
                </div>
                <div className="mt-6">
                  {auditResult ? (
                    <IssuesTable issues={auditResult.issues} />
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
                      Aún no hay resultados. Ejecuta el diagnóstico para listar issues.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-6 xl:col-span-4">
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <h2 className="text-sm font-semibold text-neutral-800">On Page SEO Checker</h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Resumen de la página analizada, keywords y oportunidades.
                  </p>
                  {pageAnalysis ? (
                    <div className="mt-4 space-y-3 text-sm text-neutral-700">
                      <div>
                        <span className="font-medium text-neutral-500">Title:</span>{' '}
                        {pageAnalysis.title || 'Sin title'}
                      </div>
                      <div>
                        <span className="font-medium text-neutral-500">Meta description:</span>{' '}
                        {pageAnalysis.meta_description || 'Sin description'}
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
                      El diagnóstico ejecutará automáticamente el análisis on-page y mostrará los
                      resultados aquí.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <h2 className="text-sm font-semibold text-neutral-800">PageSpeed Insights</h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Métricas de rendimiento de la URL objetivo tras el diagnóstico.
                  </p>
                  {psiResult ? (
                    <div className="mt-4 space-y-2 text-sm text-neutral-700">
                      <div className="flex items-center justify-between">
                        <span>Performance</span>
                        <span className="font-semibold text-neutral-900">
                          {psiResult.performance_score ?? 'n/d'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(psiResult.metrics).map(([metric, value]) => (
                          <div key={metric} className="rounded-lg bg-neutral-100 px-3 py-2">
                            <div className="text-neutral-500">{metric}</div>
                            <div className="font-semibold text-neutral-800">
                              {value !== null ? Math.round(value) : 'n/d'}
                            </div>
                          </div>
                        ))}
                      </div>
                      {heavyResources > 0 ? (
                        <div className="mt-3 rounded-lg border border-neutral-100 p-3">
                          <h3 className="text-xs font-medium text-neutral-600">
                            Recursos más pesados
                          </h3>
                          <TopHeavyBar items={psiResult.heavy_requests} />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 text-xs text-neutral-500">
                      El diagnóstico lanza automáticamente la consulta PageSpeed y mostrará las
                      métricas aquí.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
