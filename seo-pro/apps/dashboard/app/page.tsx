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
import IssuesTable from '../components/IssuesTable';
import {
  SeverityPie,
  TopHeavyBar,
  SparkArea,
  RadialGauge,
  HorizontalBar,
} from '../components/Charts';
import { ConnectButtons } from '../components/ConnectButtons';
import { StatCard } from '../components/ui/StatCard';
import { Section } from '../components/ui/Section';
import {
  Activity,
  GaugeCircle,
  MousePointerClick,
  LineChart,
  Target,
  Rocket,
} from 'lucide-react';

const SEVERITY_ORDER: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

const formatNumber = (value: number | null | undefined) =>
  value === null || value === undefined || Number.isNaN(value)
    ? 'n/d'
    : Number(value).toLocaleString('es-ES');

const formatDateLabel = (value: string) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    });
  }
  return value;
};

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
        setServiceNotice(
          err instanceof Error
            ? err.message
            : 'No se pudo contactar con el servicio auditor en http://127.0.0.1:8000. Asegurate de que este ejecutandose.'
        );
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

  const [hostname, siteOrigin] = useMemo(() => {
    try {
      const parsed = new URL(targetUrl);
      return [parsed.hostname, parsed.origin];
    } catch {
      const cleaned = targetUrl.replace(/^https?:\/\//, '');
      return [cleaned, `https://${cleaned}`];
    }
  }, [targetUrl]);

  const gaAvailable = Boolean(ga4Summary && ga4Summary.available !== false);
  const gaTotals = gaAvailable ? ga4Summary?.totals ?? {} : {};
  const gaTimeseries = useMemo(() => {
    if (!gaAvailable) return [];
    return (ga4Summary?.timeseries ?? []).map((point: any) => ({
      label: formatDateLabel(point.date),
      users: Number(point.users ?? 0),
      sessions: Number(point.sessions ?? 0),
      views: Number(point.views ?? 0),
    }));
  }, [gaAvailable, ga4Summary]);

  const gscAvailable = Boolean(gscSummary && gscSummary.available !== false);
  const gscClicks = gscAvailable ? Number(gscSummary?.clicks ?? 0) : null;
  const gscImpressions = gscAvailable ? Number(gscSummary?.impressions ?? 0) : null;
  const gscCtrPercent = gscAvailable ? Math.round((gscSummary?.ctr ?? 0) * 100) : null;
  const gscWindow =
    gscAvailable && gscSummary?.start_date && gscSummary?.end_date
      ? `${gscSummary.start_date} -> ${gscSummary.end_date}`
      : null;
  const gscTopQueries = gscAvailable
    ? (gscSummary?.top_queries ?? []).map((row: any) => ({
        query: row.query || 'n/d',
        clicks: Number(row.clicks ?? 0),
        impressions: Number(row.impressions ?? 0),
        ctr: Number(row.ctr ?? 0),
      }))
    : [];

  const rankingAvailable = Boolean(rankingSummary && rankingSummary.available !== false);
  const rankingPosition = rankingAvailable ? rankingSummary?.position ?? null : null;
  const backlinkAvailable = Boolean(backlinkSummary && backlinkSummary.available !== false);
  const refDomains = backlinkAvailable ? backlinkSummary?.ref_domains ?? null : null;

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
      if (result.ga4 && result.ga4.available === false && result.ga4.reason) {
        notices.push(`GA4: ${result.ga4.reason}`);
      }
      if (result.gsc && result.gsc.available === false && result.gsc.reason) {
        notices.push(`GSC: ${result.gsc.reason}`);
      }
      if (result.rankings && result.rankings.available === false && result.rankings.reason) {
        notices.push(`Rank tracking: ${result.rankings.reason}`);
      }
      if (result.backlinks && result.backlinks.available === false && result.backlinks.reason) {
        notices.push(`Backlinks: ${result.backlinks.reason}`);
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
          : 'No se pudieron obtener los datos. Verifica la URL e intenta de nuevo.'
      );
    } finally {
      setDiagnosticLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--colors-background-default)] text-[var(--colors-foreground-default)]">
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="badge">SEO PRO</div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--colors-muted-foreground)]">Control Center</p>
              <h1 className="text-2xl font-semibold">Panel de SEO</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="surface flex items-center gap-2 px-4 py-2">
              <svg className="h-4 w-4 text-[var(--colors-muted-foreground)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </svg>
              <input
                className="border-0 bg-transparent text-sm text-[var(--colors-foreground-default)] focus:outline-none"
                placeholder="Buscar dominio..."
              />
            </div>
            <button className="btn btn-ghost">Ver reportes</button>
            <button className="btn btn-primary">
              <Rocket className="h-4 w-4" /> Aadir proyecto
            </button>
          </div>
        </header>

        <section className="surface rounded-[calc(var(--radius)*1.2)] p-8">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="badge">Auditoria activa</div>
                <span className="text-xs text-[var(--colors-muted-foreground)]">
                  {apiUp === false ? 'API desconectada' : 'Sincronizado con auditor'}
                </span>
              </div>
              <div>
                <h2 className="text-3xl font-bold tracking-tight">{hostname}</h2>
                <p className="mt-2 text-sm text-[var(--colors-muted-foreground)]">
                  Diagnostica rendimiento tecnico, contenidos y velocidad desde un unico panel.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="surface-muted flex items-center gap-4 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--colors-muted-foreground)]">Health score</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--colors-foreground-default)]">
                      {siteHealthScore !== null ? siteHealthScore : 'n/d'}
                    </p>
                    <p className="text-xs text-[var(--colors-muted-foreground)]">Actualizado hoy</p>
                  </div>
                  <RadialGauge value={siteHealthScore ?? 0} label="Score" />
                </div>
                <div className="surface-muted grid grid-cols-2 gap-3 p-4 text-sm text-[var(--colors-muted-foreground)]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em]">Issues detectados</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--colors-foreground-default)]">
                      {auditResult ? auditResult.count : 'n/d'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em]">Paginas rastreadas</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--colors-foreground-default)]">
                      {auditResult ? auditResult.scanned : 'n/d'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <ConnectButtons site={siteOrigin} />
                <button className="btn btn-ghost">
                  <Activity className="h-4 w-4" /> Compartir reporte
                </button>
                <button className="btn btn-primary">
                  <Rocket className="h-4 w-4" /> Insight con IA
                </button>
              </div>
            </div>

            <form
              className="surface-muted space-y-4 p-6"
              onSubmit={(event) => {
                event.preventDefault();
                void handleFullDiagnostic();
              }}
            >
              <div>
                <h3 className="text-sm font-semibold text-[var(--colors-foreground-default)]">Diagnostico rapido</h3>
                <p className="mt-1 text-xs text-[var(--colors-muted-foreground)]">
                  Introduce la URL y las keywords objetivo para lanzar la auditoria completa.
                </p>
              </div>
              <label className="block text-xs font-semibold text-[var(--colors-muted-foreground)]">
                URL objetivo
                <input
                  value={targetUrl}
                  onChange={(event) => setTargetUrl(event.target.value)}
                  className="input mt-2"
                  placeholder="https://tu-dominio.com"
                  required
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--colors-muted-foreground)]">
                Keywords objetivo
                <input
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  className="input mt-2"
                  placeholder="keyword principal, marca"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[var(--colors-muted-foreground)]">
                  Max. URLs
                  <input
                    type="number"
                    value={maxUrls}
                    min={20}
                    max={500}
                    onChange={(event) => setMaxUrls(Number(event.target.value) || maxUrls)}
                    className="input mt-2"
                  />
                </label>
                <label className="block text-xs font-semibold text-[var(--colors-muted-foreground)]">
                  Estrategia PSI
                  <select
                    value={psiStrategy}
                    onChange={(event) => setPsiStrategy(event.target.value as 'mobile' | 'desktop')}
                    className="input mt-2"
                  >
                    <option value="mobile">Mobile</option>
                    <option value="desktop">Desktop</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
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
                  className="btn btn-ghost"
                >
                  Reiniciar
                </button>
                <button type="submit" className="btn btn-primary" disabled={diagnosticLoading}>
                  {diagnosticLoading ? 'Diagnosticando...' : 'Lanzar diagnostico completo'}
                </button>
              </div>
            </form>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Usuarios (GA4)" value={formatNumber(gaTotals.users ?? null)} delta="ltimos 28 das" icon={<Activity className="h-5 w-5 text-[var(--colors-primary-default)]" />} />
          <StatCard label="Sesiones (GA4)" value={formatNumber(gaTotals.sessions ?? null)} icon={<LineChart className="h-5 w-5 text-[var(--colors-primary-default)]" />} />
          <StatCard label="Vistas (GA4)" value={formatNumber(gaTotals.views ?? null)} icon={<MousePointerClick className="h-5 w-5 text-[var(--colors-primary-default)]" />} />
          <StatCard label="Ranking principal" value={rankingPosition ? `#${rankingPosition}` : 'n/d'} icon={<Target className="h-5 w-5 text-[var(--colors-primary-default)]" />} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Section title="Tendencia GA4">
            {gaAvailable && gaTimeseries.length > 0 ? (
              <div className="h-64">
                <SparkArea data={gaTimeseries} dataKey="users" />
              </div>
            ) : (
              <div className="surface-muted p-6 text-sm text-[var(--colors-muted-foreground)]">
                Ejecuta el diagnostico para visualizar la serie temporal de GA4.
              </div>
            )}
          </Section>

          <Section title="Consultas principales (GSC)">
            {gscAvailable && gscTopQueries.length > 0 ? (
              <div className="h-64">
                <HorizontalBar data={gscTopQueries.slice(0, 6)} dataKey="clicks" categoryKey="query" color="#fb923c" />
              </div>
            ) : (
              <div className="surface-muted p-6 text-sm text-[var(--colors-muted-foreground)]">
                Conecta Search Console y ejecuta el diagnostico para ver las consultas clave.
              </div>
            )}
          </Section>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Section title="CTR organico (GSC)" className="xl:col-span-1">
            <div className="flex items-center justify-between gap-6">
              <div className="space-y-3 text-sm text-[var(--colors-muted-foreground)]">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em]">Ventana</p>
                  <p className="text-lg font-semibold text-[var(--colors-foreground-default)]">
                    {gscWindow ?? 'No definida'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="surface-muted p-3 text-center">
                    <div className="text-xs text-[var(--colors-muted-foreground)]">Clicks</div>
                    <div className="text-lg font-semibold text-[var(--colors-foreground-default)]">
                      {formatNumber(gscClicks)}
                    </div>
                  </div>
                  <div className="surface-muted p-3 text-center">
                    <div className="text-xs text-[var(--colors-muted-foreground)]">Impresiones</div>
                    <div className="text-lg font-semibold text-[var(--colors-foreground-default)]">
                      {formatNumber(gscImpressions)}
                    </div>
                  </div>
                </div>
              </div>
              <RadialGauge value={gscCtrPercent ?? 0} label="CTR" color="#f97316" />
            </div>
          </Section>

          <Section title="Distribucion de severidad" className="xl:col-span-1">
            <SeverityPie data={auditCounts} />
          </Section>

          <Section title="Link building" className="xl:col-span-1">
            <div className="grid gap-4 text-sm text-[var(--colors-muted-foreground)]">
              <div className="surface-muted p-4">
                <div className="text-xs uppercase tracking-[0.2em]">Dominios de referencia</div>
                <div className="mt-2 text-xl font-semibold text-[var(--colors-foreground-default)]">
                  {backlinkAvailable ? formatNumber(refDomains) : 'n/d'}
                </div>
              </div>
              <div className="surface-muted p-4">
                <div className="text-xs uppercase tracking-[0.2em]">Notas</div>
                <p>
                  {backlinkAvailable
                    ? 'Monitoriza los nuevos backlinks y elimina los toxicos.'
                    : 'Conecta tu proveedor de backlinks para obtener metricas reales.'}
                </p>
              </div>
            </div>
          </Section>
        </div>

        <Section title="Recursos mas pesados (PSI)">
          {psiResult && heavyResources > 0 ? (
            <TopHeavyBar items={psiResult.heavy_requests} />
          ) : (
            <div className="surface-muted p-6 text-sm text-[var(--colors-muted-foreground)]">
              Ejecuta PageSpeed Insights para obtener el peso de los recursos.
            </div>
          )}
        </Section>

        <div className="grid gap-4 xl:grid-cols-3">
          <Section title="Auditoria tecnica" className="xl:col-span-2">
            <div className="surface-muted flex items-center justify-between gap-6 p-4 text-sm text-[var(--colors-muted-foreground)]">
              <span>
                Issues totales:
                <span className="ml-2 text-lg font-semibold text-[var(--colors-foreground-default)]">
                  {auditResult ? auditResult.count : 'n/d'}
                </span>
              </span>
              <span>
                Paginas rastreadas:
                <span className="ml-2 text-lg font-semibold text-[var(--colors-foreground-default)]">
                  {auditResult ? auditResult.scanned : 'n/d'}
                </span>
              </span>
            </div>
            <div className="mt-4">
              {auditResult ? (
                <IssuesTable issues={auditResult.issues} />
              ) : (
                <div className="surface-muted p-6 text-sm text-[var(--colors-muted-foreground)]">
                  Aun no hay resultados. Ejecuta la auditoria para listar issues.
                </div>
              )}
            </div>
          </Section>

          <div className="space-y-4">
            <Section title="On Page SEO Checker">
              {pageAnalysis ? (
                <div className="space-y-3 text-sm text-[var(--colors-muted-foreground)]">
                  <div>
                    <span className="text-xs uppercase tracking-[0.2em]">Title</span>
                    <p className="mt-1 text-base font-semibold text-[var(--colors-foreground-default)]">
                      {pageAnalysis.title || 'Sin title'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-[0.2em]">Meta description</span>
                    <p className="mt-1 text-[var(--colors-foreground-default)]">
                      {pageAnalysis.meta_description || 'Sin description'}
                    </p>
                  </div>
                  <div className="surface-muted p-3 text-xs">
                    {totalRecommendations > 0
                      ? `${totalRecommendations} ideas detectadas.`
                      : 'No se detectaron incidencias relevantes.'}
                  </div>
                </div>
              ) : (
                <div className="surface-muted p-4 text-xs text-[var(--colors-muted-foreground)]">
                  El diagnostico ejecutara automaticamente el analisis on-page.
                </div>
              )}
            </Section>

            <Section title="PageSpeed Insights">
              {psiResult ? (
                <div className="space-y-2 text-sm text-[var(--colors-muted-foreground)]">
                  <div className="flex items-center justify-between">
                    <span>Performance</span>
                    <span className="text-lg font-semibold text-[var(--colors-foreground-default)]">
                      {psiResult.performance_score ?? 'n/d'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(psiResult.metrics).map(([metric, value]) => (
                      <div key={metric} className="surface-muted p-3">
                        <div className="text-[var(--colors-muted-foreground)]">{metric}</div>
                        <div className="text-lg font-semibold text-[var(--colors-foreground-default)]">
                          {value !== null ? Math.round(value) : 'n/d'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="surface-muted p-4 text-xs text-[var(--colors-muted-foreground)]">
                  El diagnostico mostrara aqui las metricas de PageSpeed.
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
