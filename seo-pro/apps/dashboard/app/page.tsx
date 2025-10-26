'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  health,
  runDiagnostic,
  type AnalyzePage,
  type AuditResponse,
  type DiagnosticResponse,
  type PsiResponse,
  type Severity,
} from '../lib/api';
import {
  getBacklinkEvents,
  getBacklinkKpis,
  getBacklinkList,
  type BacklinkEvent,
  type BacklinkKpis,
  type BacklinkRecord,
} from '../lib/backlinks';
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
import { Table } from '../components/ui/Table';
import {
  Activity,
  MousePointerClick,
  LineChart,
  Target,
  Rocket,
  Zap,
  ArrowUp,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Link2,
  Globe,
} from 'lucide-react';

const SEVERITY_ORDER: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
const BACKLINKS_PROJECT_ID = 1;

const formatNumber = (value: number | null | undefined) =>
  value === null || value === undefined || Number.isNaN(value)
    ? 'n/d'
    : Number(value).toLocaleString('es-ES');
const formatDecimal = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined || Number.isNaN(value)
    ? 'n/d'
    : Number(value).toLocaleString('es-ES', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

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
const formatEventType = (type: string) => {
  switch (type) {
    case 'new':
      return 'Nuevo';
    case 'lost':
      return 'Perdido';
    case 'changed':
      return 'Actualizado';
    case 'recovered':
      return 'Recuperado';
    default:
      return type;
  }
};
const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/d';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const humanizeMetric = (value: string) =>
  value
    .split('_')
    .map((segment) => (segment.length > 0 ? segment[0].toUpperCase() + segment.slice(1) : segment))
    .join(' ');

type GaTimeseriesPoint = {
  label: string;
  users: number;
  sessions: number;
  views: number;
};

type GscQuery = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
};

export default function DashboardPage() {
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  const [backlinkKpis, setBacklinkKpis] = useState<BacklinkKpis | null>(null);
  const [backlinkEvents, setBacklinkEvents] = useState<BacklinkEvent[]>([]);
  const [recentBacklinks, setRecentBacklinks] = useState<BacklinkRecord[]>([]);
  const [backlinkLoading, setBacklinkLoading] = useState(false);
  const [backlinkError, setBacklinkError] = useState<string | null>(null);

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
            : 'No se pudo contactar con el auditor en http://127.0.0.1:8000. Asegurate de que este ejecutandose.'
        );
      });
  }, []);

  useEffect(() => {
    setBacklinkLoading(true);
    Promise.all([
      getBacklinkKpis(BACKLINKS_PROJECT_ID),
      getBacklinkEvents(BACKLINKS_PROJECT_ID),
      getBacklinkList({ project_id: BACKLINKS_PROJECT_ID, page: 1, page_size: 6 }),
    ])
      .then(([kpis, events, backlinks]) => {
        setBacklinkKpis(kpis);
        setBacklinkEvents(events);
        setRecentBacklinks(backlinks.items);
        setBacklinkError(null);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setBacklinkError(message);
      })
      .finally(() => setBacklinkLoading(false));
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
      return [cleaned, 'https://' + cleaned];
    }
  }, [targetUrl]);

  const gaAvailable = Boolean(ga4Summary && ga4Summary.available !== false);
  const gaTotals = gaAvailable ? ga4Summary?.totals ?? {} : {};
  const gaTimeseries = useMemo<GaTimeseriesPoint[]>(() => {
    if (!gaAvailable) return [];
    return (ga4Summary?.timeseries ?? []).map((point: any): GaTimeseriesPoint => ({
      label: formatDateLabel(point.date),
      users: Number(point.users ?? 0),
      sessions: Number(point.sessions ?? 0),
      views: Number(point.views ?? 0),
    }));
  }, [gaAvailable, ga4Summary]);

  const bestGaDay = useMemo<GaTimeseriesPoint | null>(() => {
    if (gaTimeseries.length === 0) return null;
    return gaTimeseries.reduce<GaTimeseriesPoint>(
      (acc, item) => (item.users > acc.users ? item : acc),
      gaTimeseries[0]
    );
  }, [gaTimeseries]);

  const gscAvailable = Boolean(gscSummary && gscSummary.available !== false);
  const gscClicks = gscAvailable ? Number(gscSummary?.clicks ?? 0) : null;
  const gscImpressions = gscAvailable ? Number(gscSummary?.impressions ?? 0) : null;
  const gscCtrPercent = gscAvailable ? Math.round((gscSummary?.ctr ?? 0) * 100) : null;
  const gscWindow =
    gscAvailable && gscSummary?.start_date && gscSummary?.end_date
      ? `${gscSummary.start_date} -> ${gscSummary.end_date}`
      : null;
  const gscTopQueries: GscQuery[] = gscAvailable
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

  const criticalIssues = useMemo(() => {
    if (!auditResult) return [] as AuditResponse['issues'];
    return auditResult.issues
      .filter((issue) => issue.severity === 'Critical' || issue.severity === 'High')
      .slice(0, 6);
  }, [auditResult]);

  const topRecommendations = useMemo(
    () => pageAnalysis?.recommendations?.slice(0, 6) ?? [],
    [pageAnalysis]
  );

  const gaUserTrend = useMemo(() => {
    if (gaTimeseries.length < 2) return null;
    const first = gaTimeseries[0].users || 0;
    const last = gaTimeseries[gaTimeseries.length - 1].users || 0;
    if (first === 0) {
      return last > 0 ? 100 : null;
    }
    return Math.round(((last - first) / first) * 100);
  }, [gaTimeseries]);

  const gaAverageUsers =
    gaTimeseries.length > 0
      ? Math.round(gaTimeseries.reduce((sum, item) => sum + item.users, 0) / gaTimeseries.length)
      : null;

  const rankingData = rankingSummary as Record<string, any> | null;
  const rankingKeyword =
    rankingData && typeof rankingData.top_keyword === 'string'
      ? (rankingData.top_keyword as string)
      : rankingData && Array.isArray(rankingData.top_keywords) && rankingData.top_keywords.length > 0
      ? rankingData.top_keywords[0]
      : null;

  const alerts = useMemo(() => {
    const list: { type: 'error' | 'notice'; message: string }[] = [];
    if (error) list.push({ type: 'error', message: error });
    if (serviceNotice) list.push({ type: 'error', message: serviceNotice });
    if (notice) list.push({ type: 'notice', message: notice });
    return list;
  }, [error, notice, serviceNotice]);
  const backlinkHighlights = useMemo(() => {
    if (!backlinkKpis) return [];
    const follow = formatDecimal(backlinkKpis.follow_ratio);
    const toxicity = formatDecimal(backlinkKpis.toxicity_avg);
    return [
      {
        label: 'Backlinks totales',
        value: formatNumber(backlinkKpis.total_backlinks),
        delta: `+${formatNumber(backlinkKpis.new_30)} (30d)`,
      },
      {
        label: 'Referring domains',
        value: formatNumber(backlinkKpis.referring_domains),
      },
      {
        label: 'Nuevos (7d)',
        value: formatNumber(backlinkKpis.new_7),
        delta: `30d: ${formatNumber(backlinkKpis.new_30)}`,
      },
      {
        label: 'Perdidos (7d)',
        value: formatNumber(backlinkKpis.lost_7),
        delta: `30d: ${formatNumber(backlinkKpis.lost_30)}`,
      },
      {
        label: '% Follow',
        value: follow === 'n/d' ? follow : `${follow}%`,
      },
      {
        label: 'Toxicidad media',
        value: toxicity,
      },
    ];
  }, [backlinkKpis]);
  const recentBacklinkEvents = useMemo(() => {
    if (backlinkEvents.length === 0) return [];
    const index = new Map(recentBacklinks.map((item) => [item.id, item]));
    return backlinkEvents.slice(0, 6).map((event) => ({
      event,
      backlink: index.get(event.backlink_id) ?? null,
    }));
  }, [backlinkEvents, recentBacklinks]);

  const kpiCards = [
    {
      key: 'ga-users',
      label: 'Usuarios (GA4)',
      value: formatNumber(gaTotals.users ?? null),
      delta: gaAvailable && bestGaDay ? 'Mejor dia: ' + bestGaDay.label : undefined,
      icon: <Activity className="h-5 w-5 text-[var(--colors-primary-default)]" />,
      accent: 'primary' as const,
    },
    {
      key: 'ga-sessions',
      label: 'Sesiones',
      value: formatNumber(gaTotals.sessions ?? null),
      delta: gaUserTrend !== null ? (gaUserTrend >= 0 ? '+' : '') + gaUserTrend + '% vs inicio' : undefined,
      icon: <LineChart className="h-5 w-5 text-[var(--colors-primary-default)]" />,
    },
    {
      key: 'ga-views',
      label: 'Vistas',
      value: formatNumber(gaTotals.views ?? null),
      icon: <MousePointerClick className="h-5 w-5 text-[var(--colors-primary-default)]" />,
    },
    {
      key: 'gsc-clicks',
      label: 'Clicks GSC',
      value: formatNumber(gscClicks ?? null),
      delta: gscCtrPercent !== null ? 'CTR medio ' + gscCtrPercent + '%' : undefined,
      icon: <TrendingUp className="h-5 w-5 text-[var(--colors-primary-default)]" />,
    },
    {
      key: 'ranking',
      label: 'Ranking principal',
      value: rankingPosition ? '#' + rankingPosition : 'n/d',
      delta: rankingKeyword ? 'Keyword: ' + rankingKeyword : undefined,
      icon: <Target className="h-5 w-5 text-[var(--colors-primary-default)]" />,
    },
    {
      key: 'health',
      label: 'Health score',
      value: siteHealthScore !== null ? siteHealthScore : 'n/d',
      delta: auditResult ? 'Issues: ' + auditResult.count : undefined,
      icon: <ShieldCheck className="h-5 w-5 text-[var(--colors-primary-default)]" />,
    },
  ];

  const quickWins = useMemo<GscQuery[]>(() => gscTopQueries.slice(0, 3), [gscTopQueries]);

  const psiMetricList = useMemo(
    () =>
      psiResult?.metrics
        ? Object.entries(psiResult.metrics)
            .slice(0, 5)
            .map(([key, value]) => ({
              name: humanizeMetric(key),
              value: typeof value === 'number' ? Math.round(value) : value ?? 'n/d',
            }))
        : [],
    [psiResult]
  );

  const psiScore =
    typeof psiResult?.performance_score === 'number' ? Math.round(psiResult.performance_score) : null;

  const auditCriticalCount = auditCounts.find((item) => item.name === 'Critical')?.value ?? 0;

  const gscTableColumns = [
    { key: 'query', label: 'Query', align: 'left' as const },
    {
      key: 'clicks',
      label: 'Clicks',
      align: 'right' as const,
      format: (value: number) => formatNumber(value ?? null),
    },
    {
      key: 'impressions',
      label: 'Impresiones',
      align: 'right' as const,
      format: (value: number) => formatNumber(value ?? null),
    },
    {
      key: 'ctr',
      label: 'CTR',
      align: 'right' as const,
      format: (value: number) => {
        const percent = typeof value === 'number' ? value : null;
        return percent !== null ? (percent * 100).toFixed(1) + '%' : 'n/d';
      },
    },
  ];
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
        errors.push('Auditoria: ' + (result.audit.error ?? 'sin detalle'));
      }

      if (result.analysis.ok && result.analysis.data) {
        setPageAnalysis(result.analysis.data);
      } else {
        setPageAnalysis(null);
        errors.push('On-page: ' + (result.analysis.error ?? 'sin detalle'));
      }

      if (result.psi.ok && result.psi.data) {
        setPsiResult(result.psi.data);
      } else {
        setPsiResult(null);
        errors.push('PageSpeed: ' + (result.psi.error ?? 'sin detalle'));
      }

      setGa4Summary(result.ga4 ?? null);
      setGscSummary(result.gsc ?? null);
      setRankingSummary(result.rankings ?? null);
      setBacklinkSummary(result.backlinks ?? null);

      const notices: string[] = [];
      if (result.ga4 && result.ga4.available === false && result.ga4.reason) {
        notices.push('GA4: ' + result.ga4.reason);
      }
      if (result.gsc && result.gsc.available === false && result.gsc.reason) {
        notices.push('GSC: ' + result.gsc.reason);
      }
      if (result.rankings && result.rankings.available === false && result.rankings.reason) {
        notices.push('Rank tracking: ' + result.rankings.reason);
      }
      if (result.backlinks && result.backlinks.available === false && result.backlinks.reason) {
        notices.push('Backlinks: ' + result.backlinks.reason);
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
    <div className="min-h-screen bg-[var(--colors-background-default)] pb-24 text-[var(--colors-foreground-default)]">
      <div className="mx-auto max-w-[1180px] space-y-8 px-6 py-10">
        <header className="flex flex-wrap items-center gap-5 rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)]/90 p-5 shadow-[var(--shadows-default)] backdrop-blur transition">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--colors-accent-default)] text-[var(--colors-muted-foreground)]">
              <Globe className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-[var(--colors-muted-foreground)]">Seo Control</p>
              <h1 className="text-xl font-semibold">Centro de mando SEO</h1>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button className="btn btn-ghost transition hover:-translate-y-0.5">
              <Zap className="h-4 w-4" /> Compartir reporte
            </button>
            <button className="btn btn-primary transition hover:-translate-y-0.5">
              <Rocket className="h-4 w-4" /> Anadir proyecto
            </button>
          </div>
        </header>

        {alerts.length > 0 && (
          <div className="space-y-3">
            {alerts.map((item, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 rounded-[var(--radius)] border px-4 py-3 text-sm shadow-sm transition ${
                  item.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{item.message}</span>
              </div>
            ))}
          </div>
        )}

        <nav className="flex flex-wrap items-center gap-2 text-xs text-[var(--colors-muted-foreground)]">
          <span>Panel</span>
          <span className="opacity-60">/</span>
          <span className="font-medium text-[var(--colors-foreground-default)]">{hostname}</span>
          {gscWindow ? (
            <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] px-3 py-1">
              <TrendingUp className="h-3 w-3 text-[var(--colors-primary-default)]" />
              {gscWindow}
            </span>
          ) : (
            <span className="ml-auto text-[var(--colors-muted-foreground)]">Periodo automatico</span>
          )}
        </nav>

        <Section
          title="Backlinks overview"
          className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
          actions={
            <Link
              href="/backlinks"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--colors-primary-default)] hover:underline"
            >
              Ver dashboard completo
            </Link>
          }
        >
          {backlinkError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {backlinkError}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {backlinkHighlights.length > 0 ? (
              backlinkHighlights.map((card) => (
                <StatCard key={card.label} label={card.label} value={card.value} delta={card.delta} />
              ))
            ) : (
              <div className="surface-muted rounded-[var(--radius)] p-4 text-xs text-[var(--colors-muted-foreground)]">
                {backlinkLoading
                  ? 'Cargando métricas de backlinks...'
                  : 'Conecta el módulo de backlinks para ver KPIs clave.'}
              </div>
            )}
          </div>
        </Section>

        <Section
          title="Eventos recientes de backlinks"
          className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
          actions={
            <Link
              href="/backlinks#activity"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--colors-primary-default)] hover:underline"
            >
              Ver actividad
            </Link>
          }
        >
          {recentBacklinkEvents.length === 0 ? (
            <div className="surface-muted rounded-[var(--radius)] p-4 text-xs text-[var(--colors-muted-foreground)]">
              {backlinkLoading ? 'Sincronizando eventos...' : 'Sin eventos registrados en los últimos días.'}
            </div>
          ) : (
            <Table
              columns={['Evento', 'Backlink', 'Fecha']}
              rows={recentBacklinkEvents.map(({ event, backlink }) => [
                <span
                  key={`type-${event.id}`}
                  className="capitalize font-semibold text-[var(--colors-foreground-default)]"
                >
                  {formatEventType(event.event_type)}
                </span>,
                <span key={`url-${event.id}`} className="truncate text-sm text-[var(--colors-primary-default)]">
                  {backlink?.target_url ?? `Backlink #${event.backlink_id}`}
                </span>,
                <span key={`date-${event.id}`} className="text-xs text-[var(--colors-muted-foreground)]">
                  {formatDateTime(event.event_at)}
                </span>,
              ])}
            />
          )}
        </Section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="relative overflow-hidden rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] shadow-[var(--shadows-md)] transition hover:-translate-y-1 hover:shadow-lg">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 via-rose-400 to-purple-500" />
            <div className="relative space-y-6 p-8">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
                    apiUp === false ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${apiUp === false ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                  {apiUp === false ? 'API desconectada' : 'Auditoria activa'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] px-3 py-1 text-[var(--colors-muted-foreground)]">
                  Max rastreo {maxUrls} URLs
                </span>
                {gscSummary?.property ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] px-3 py-1 text-[var(--colors-muted-foreground)]">
                    GSC conectado
                  </span>
                ) : null}
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">{hostname}</h2>
                <p className="mt-2 max-w-2xl text-sm text-[var(--colors-muted-foreground)]">
                  Monitorea en un solo lugar el rendimiento organico, problemas tecnicos y oportunidades de crecimiento.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-4 rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-background-default)]/60 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                  <RadialGauge value={siteHealthScore ?? 0} label="Score" color="#f97316" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--colors-muted-foreground)]">Health score</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--colors-foreground-default)]">
                      {siteHealthScore !== null ? siteHealthScore : 'n/d'}
                    </p>
                    <p className="text-xs text-[var(--colors-muted-foreground)]">
                      {auditResult ? auditResult.count + ' incidencias detectadas' : 'Ejecuta un rastreo para ver incidencias'}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div className="surface-muted rounded-[var(--radius)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em]">Issues</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--colors-foreground-default)]">
                      {auditResult ? auditResult.count : 'n/d'}
                    </p>
                  </div>
                  <div className="surface-muted rounded-[var(--radius)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em]">Paginas rastreadas</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--colors-foreground-default)]">
                      {auditResult ? auditResult.scanned : 'n/d'}
                    </p>
                  </div>
                  <div className="surface-muted rounded-[var(--radius)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em]">Ideas SEO</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--colors-foreground-default)]">
                      {totalRecommendations > 0 ? totalRecommendations : 'n/d'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ConnectButtons site={siteOrigin} />
                <button className="btn btn-ghost transition hover:-translate-y-0.5">
                  <TrendingUp className="h-4 w-4" /> Informe rapido
                </button>
                <button className="btn btn-primary transition hover:-translate-y-0.5">
                  <Rocket className="h-4 w-4" /> Insight IA
                </button>
              </div>
            </div>
          </div>
          <form
            className="relative overflow-hidden rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] shadow-[var(--shadows-md)] transition hover:-translate-y-1 hover:shadow-lg"
            onSubmit={(event) => {
              event.preventDefault();
              void handleFullDiagnostic();
            }}
          >
            <div className="pointer-events-none absolute -top-12 right-0 h-36 w-36 rounded-full bg-[var(--colors-primary-default)]/15 blur-3xl" />
            <div className="relative space-y-5 p-6">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--colors-foreground-default)]">
                  <Zap className="h-5 w-5 text-[var(--colors-primary-default)]" />
                  Lanzar diagnostico
                </h3>
                <p className="mt-1 text-xs text-[var(--colors-muted-foreground)]">
                  Rastrea tu sitio, recopila GA4 y Search Console y genera insight accionable en segundos.
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
                  Max URLs
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
                  {diagnosticLoading ? 'Diagnosticando...' : 'Iniciar diagnostico'}
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {kpiCards.map((card) => (
            <StatCard
              key={card.key}
              label={card.label}
              value={card.value}
              delta={card.delta}
              icon={card.icon}
              accent={card.accent}
            />
          ))}
        </section>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Section
              title="Rendimiento organico (GA4)"
              actions={
                gaAvailable && gaTimeseries.length > 0 ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[var(--colors-accent-default)]/60 px-3 py-1 text-xs font-semibold text-[var(--colors-muted-foreground)]">
                    <Activity className="h-3 w-3 text-[var(--colors-primary-default)]" />
                    {gaTimeseries.length} dias
                  </span>
                ) : undefined
              }
              className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
            >
              {gaAvailable && gaTimeseries.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--colors-muted-foreground)]">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] px-3 py-1">
                      <Activity className="h-3 w-3 text-[var(--colors-primary-default)]" />
                      Usuarios
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] px-3 py-1">
                      <LineChart className="h-3 w-3 text-[var(--colors-primary-default)]" />
                      Sesiones
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] px-3 py-1">
                      <MousePointerClick className="h-3 w-3 text-[var(--colors-primary-default)]" />
                      Vistas
                    </span>
                  </div>
                  <div className="h-64">
                    <SparkArea data={gaTimeseries} dataKey="users" />
                  </div>
                  <div className="grid gap-3 text-sm text-[var(--colors-muted-foreground)] sm:grid-cols-3">
                    <div className="surface-muted rounded-[var(--radius)] p-4">
                      <p className="text-xs uppercase tracking-[0.2em]">Mejor dia</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--colors-foreground-default)]">
                        {bestGaDay ? bestGaDay.label : 'n/d'}
                      </p>
                    </div>
                    <div className="surface-muted rounded-[var(--radius)] p-4">
                      <p className="text-xs uppercase tracking-[0.2em]">Usuarios medios</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--colors-foreground-default)]">
                        {gaAverageUsers !== null ? gaAverageUsers : 'n/d'}
                      </p>
                    </div>
                    <div className="surface-muted rounded-[var(--radius)] p-4">
                      <p className="text-xs uppercase tracking-[0.2em]">Tendencia</p>
                      <p className={`mt-2 text-lg font-semibold ${gaUserTrend !== null && gaUserTrend < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {gaUserTrend !== null ? (gaUserTrend >= 0 ? '+' : '') + gaUserTrend + '%' : 'n/d'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="surface-muted rounded-[var(--radius)] p-6 text-sm text-[var(--colors-muted-foreground)]">
                  Lanza el diagnostico para poblar los datos de GA4.
                </div>
              )}
            </Section>

            <Section
              title="Consultas Search Console"
              className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
            >
              {gscAvailable && gscTopQueries.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                  <div className="h-64">
                    <HorizontalBar data={gscTopQueries.slice(0, 6)} dataKey="clicks" categoryKey="query" color="#6366f1" />
                  </div>
                  <div className="rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] p-4">
                    <Table columns={gscTableColumns} rows={gscTopQueries.slice(0, 6)} />
                  </div>
                </div>
              ) : (
                <div className="surface-muted rounded-[var(--radius)] p-6 text-sm text-[var(--colors-muted-foreground)]">
                  Conecta Search Console y ejecuta el diagnostico para ver consultas y volumen.
                </div>
              )}
            </Section>

            <div className="grid gap-6 lg:grid-cols-2">
              <Section
                title="Distribucion de severidad"
                className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="md:w-1/2">
                    <SeverityPie data={auditCounts} />
                  </div>
                  <div className="grid flex-1 gap-3 text-sm text-[var(--colors-muted-foreground)]">
                    {auditCounts.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] px-3 py-2"
                      >
                        <span className="font-medium text-[var(--colors-foreground-default)]">{item.name}</span>
                        <span className="text-xs uppercase tracking-[0.2em]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>

              <Section
                title="Link building"
                className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
              >
                <div className="space-y-4 text-sm text-[var(--colors-muted-foreground)]">
                  <div className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] p-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em]">Dominios de referencia</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--colors-foreground-default)]">
                        {backlinkAvailable ? formatNumber(refDomains) : 'n/d'}
                      </p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--colors-accent-default)]/60 text-[var(--colors-primary-default)]">
                      <Link2 className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] p-4">
                    <p>
                      {backlinkAvailable
                        ? 'Monitoriza los nuevos backlinks, identifica enlaces toxicos y refuerza las paginas clave.'
                        : 'Conecta tu proveedor de backlinks para obtener metricas reales y analizar tu perfil de enlaces.'}
                    </p>
                  </div>
                </div>
              </Section>
            </div>

            <Section
              title="PageSpeed Insights"
              className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
              actions={
                psiScore !== null ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                    Score {psiScore}
                  </span>
                ) : undefined
              }
            >
              {psiResult ? (
                <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <div>
                    {heavyResources > 0 ? (
                      <TopHeavyBar items={psiResult.heavy_requests} />
                    ) : (
                      <div className="surface-muted rounded-[var(--radius)] p-6 text-sm text-[var(--colors-muted-foreground)]">
                        Ejecuta el diagnostico con PageSpeed para analizar los recursos mas pesados.
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-[var(--colors-muted-foreground)]">
                    {psiMetricList.length > 0 ? (
                      psiMetricList.map((metric) => (
                        <div
                          key={metric.name}
                          className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] px-3 py-2"
                        >
                          <span>{metric.name}</span>
                          <span className="font-semibold text-[var(--colors-foreground-default)]">{metric.value}</span>
                        </div>
                      ))
                    ) : (
                      <div className="surface-muted rounded-[var(--radius)] p-4 text-xs">
                        Sin metricas disponibles.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="surface-muted rounded-[var(--radius)] p-6 text-sm text-[var(--colors-muted-foreground)]">
                  Aun no se ha consultado PageSpeed. Ejecuta el diagnostico completo para generar los datos.
                </div>
              )}
            </Section>

            <Section
              title="Auditoria tecnica"
              className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
              actions={
                auditResult ? (
                  <span className="text-xs text-[var(--colors-muted-foreground)]">
                    {auditCriticalCount} issues criticos
                  </span>
                ) : undefined
              }
            >
              {auditResult ? (
                <IssuesTable issues={auditResult.issues} />
              ) : (
                <div className="surface-muted rounded-[var(--radius)] p-6 text-sm text-[var(--colors-muted-foreground)]">
                  Aun no hay resultados. Ejecuta la auditoria para listar incidencias tecnicas.
                </div>
              )}
            </Section>
          </div>

          <aside className="space-y-6">
            <Section
              title="Quick wins organicos"
              className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
            >
              {quickWins.length > 0 ? (
                <ul className="space-y-3 text-sm text-[var(--colors-muted-foreground)]">
                  {quickWins.map((row, index) => {
                    const ctrPercent = typeof row.ctr === 'number' ? (row.ctr * 100).toFixed(1) + '%' : 'n/d';
                    return (
                      <li
                        key={row.query + index}
                        className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] p-3"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--colors-accent-default)]/70 text-[var(--colors-primary-default)]">
                          <TrendingUp className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-[var(--colors-foreground-default)]">{row.query}</p>
                          <p className="text-xs">
                            {formatNumber(row.impressions)} impresiones - {formatNumber(row.clicks)} clicks - {ctrPercent}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="surface-muted rounded-[var(--radius)] p-4 text-xs text-[var(--colors-muted-foreground)]">
                  Conecta Search Console para descubrir quick wins de visibilidad.
                </div>
              )}
            </Section>

            <Section
              title="Alertas tecnicas"
              className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
            >
              {criticalIssues.length > 0 ? (
                <ul className="space-y-3 text-sm text-[var(--colors-muted-foreground)]">
                  {criticalIssues.map((issue, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] p-3"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold text-[var(--colors-foreground-default)]">{issue.rule}</p>
                        <p className="text-xs">{issue.url}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="surface-muted rounded-[var(--radius)] p-4 text-xs text-[var(--colors-muted-foreground)]">
                  Sin incidencias criticas registradas.
                </div>
              )}
            </Section>

            <Section
              title="Ideas on-page prioritarias"
              className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
            >
              {topRecommendations.length > 0 ? (
                <ul className="space-y-2 text-sm text-[var(--colors-muted-foreground)]">
                  {topRecommendations.map((suggestion, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] p-3"
                    >
                      <ArrowUp className="mt-1 h-4 w-4 text-[var(--colors-primary-default)]" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="surface-muted rounded-[var(--radius)] p-4 text-xs text-[var(--colors-muted-foreground)]">
                  Ejecuta el analizador on-page para generar recomendaciones.
                </div>
              )}
            </Section>
          </aside>
        </div>
      </div>
    </div>
  );
}
