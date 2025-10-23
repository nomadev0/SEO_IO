'use client';

import { useEffect, useMemo, useState } from "react";
import {
  health,
  runDiagnostic,
  type AnalyzePage,
  type AuditResponse,
  type DiagnosticResponse,
  type PsiResponse,
  type Severity,
} from "../lib/api";
import { NavSidebar } from "../components/NavSidebar";
import IssuesTable from "../components/IssuesTable";
import {
  SeverityPie,
  TopHeavyBar,
  SparkArea,
  RadialGauge,
  HorizontalBar,
} from "../components/Charts";
import { ConnectButtons } from "../components/ConnectButtons";
import { StatCard } from "../components/ui/StatCard";
import { Section } from "../components/ui/Section";

const SEVERITY_ORDER: Severity[] = ["Critical", "High", "Medium", "Low"];

const formatNumber = (value: number | null | undefined) =>
  value === null || value === undefined || Number.isNaN(value)
    ? "n/d"
    : Number(value).toLocaleString("es-ES");

const formatDateLabel = (value: string) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
  }
  return value;
};

export default function DashboardPage() {
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  const [targetUrl, setTargetUrl] = useState("https://example.com");
  const [keywords, setKeywords] = useState("");
  const [maxUrls, setMaxUrls] = useState(80);
  const [psiStrategy, setPsiStrategy] = useState<"mobile" | "desktop">("mobile");

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
            : "No se pudo contactar con el servicio auditor en http://127.0.0.1:8000. Asegurate de que este ejecutandose."
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
    const critical = auditCounts.find((item) => item.name === "Critical")?.value ?? 0;
    const penalty = Math.min(95, critical * 15 + total * 4);
    return Math.max(0, 100 - penalty);
  }, [auditCounts, auditResult]);

  const [hostname, siteOrigin] = useMemo(() => {
    try {
      const parsed = new URL(targetUrl);
      return [parsed.hostname, parsed.origin];
    } catch {
      const cleaned = targetUrl.replace(/^https?:\/\//, "");
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
  const gscWindow = gscAvailable && gscSummary?.start_date && gscSummary?.end_date
    ? `${gscSummary.start_date} -> ${gscSummary.end_date}`
    : null;
  const gscTopQueries = gscAvailable
    ? (gscSummary?.top_queries ?? []).map((row: any) => ({
        query: row.query || "n/d",
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
        errors.push(`Auditoria: ${result.audit.error ?? "sin detalle"}`);
      }

      if (result.analysis.ok && result.analysis.data) {
        setPageAnalysis(result.analysis.data);
      } else {
        setPageAnalysis(null);
        errors.push(`On-page: ${result.analysis.error ?? "sin detalle"}`);
      }

      if (result.psi.ok && result.psi.data) {
        setPsiResult(result.psi.data);
      } else {
        setPsiResult(null);
        errors.push(`PageSpeed: ${result.psi.error ?? "sin detalle"}`);
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
        setError(errors.join(" | "));
      } else {
        setError(null);
      }
      setNotice(notices.length > 0 ? notices.join(" | ") : null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron obtener los datos. Verifica la URL e intenta de nuevo."
      );
    } finally {
      setDiagnosticLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <NavSidebar />
      <div className="grid min-h-screen flex-1 grid-cols-1 bg-transparent lg:pl-72">
        <header className="px-6 py-8">
          <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-800 p-8 text-white shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-indigo-200">Panel de SEO</p>
                <h1 className="mt-2 text-3xl font-semibold">{hostname}</h1>
                <p className="text-sm text-indigo-100">
                  Alcance: dominio raiz  {apiUp === false ? "API desconectada" : "API lista"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ConnectButtons site={siteOrigin} />
                <button className="btn">Exportar informe</button>
                <button className="btn">Crear proyecto SEO</button>
              </div>
            </div>

            <form
              className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6"
              onSubmit={(event) => {
                event.preventDefault();
                void handleFullDiagnostic();
              }}
            >
              <label className="xl:col-span-3">
                <span className="text-xs uppercase tracking-wide text-indigo-200">URL objetivo</span>
                <input
                  value={targetUrl}
                  onChange={(event) => setTargetUrl(event.target.value)}
                  className="input mt-2 w-full"
                  placeholder="https://tu-dominio.com"
                  required
                />
              </label>
              <label className="xl:col-span-2">
                <span className="text-xs uppercase tracking-wide text-indigo-200">Keywords objetivo</span>
                <input
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  className="input mt-2 w-full"
                  placeholder="keyword principal, marca"
                />
              </label>
              <div className="flex flex-col gap-3 xl:col-span-1 xl:flex-col xl:items-end">
                <div className="w-full">
                  <span className="text-xs uppercase tracking-wide text-indigo-200">Max. URLs</span>
                  <input
                    type="number"
                    value={maxUrls}
                    min={20}
                    max={500}
                    onChange={(event) => setMaxUrls(Number(event.target.value) || maxUrls)}
                    className="input mt-2 w-full"
                  />
                </div>
                <div className="w-full">
                  <span className="text-xs uppercase tracking-wide text-indigo-200">Estrategia PSI</span>
                  <select
                    value={psiStrategy}
                    onChange={(event) => setPsiStrategy(event.target.value as "mobile" | "desktop")}
                    className="input mt-2 w-full"
                  >
                    <option value="mobile">Mobile</option>
                    <option value="desktop">Desktop</option>
                  </select>
                </div>
              </div>
              <div className="flex items-end justify-end gap-3 md:col-span-2 xl:col-span-6">
                <button
                  type="button"
                  onClick={() => {
                    setTargetUrl("https://example.com");
                    setKeywords("");
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
                  className="btn bg-transparent text-white/80 hover:bg-white/10"
                >
                  Reset
                </button>
                <button type="submit" disabled={diagnosticLoading} className="btn">
                  {diagnosticLoading ? "Diagnosticando..." : "Lanzar diagnostico completo"}
                </button>
              </div>
            </form>
          </div>
        </header>

        <main className="space-y-8 px-6 pb-10">
          {serviceNotice ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 shadow">
              {serviceNotice}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 shadow">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-600 shadow">
              {notice}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Usuarios (GA4)" value={formatNumber(gaTotals.users ?? null)} delta="28 dias" />
            <StatCard label="Sesiones (GA4)" value={formatNumber(gaTotals.sessions ?? null)} />
            <StatCard label="Vistas (GA4)" value={formatNumber(gaTotals.views ?? null)} />
            <div className="card flex items-center justify-between">
              <div>
                <div className="subtle">Site Health</div>
                <div className="stat mt-1">{siteHealthScore !== null ? siteHealthScore : "n/d"}</div>
              </div>
              <RadialGauge value={siteHealthScore ?? 0} label="Score" />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Tendencia GA4">
              {gaAvailable && gaTimeseries.length > 0 ? (
                <div className="h-64">
                  <SparkArea data={gaTimeseries} dataKey="users" />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                  Ejecuta el diagnostico para visualizar la serie temporal de GA4.
                </div>
              )}
            </Section>

            <Section title="Consultas principales (GSC)">
              {gscAvailable && gscTopQueries.length > 0 ? (
                <div className="h-64">
                  <HorizontalBar data={gscTopQueries.slice(0, 6)} dataKey="clicks" categoryKey="query" />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                  Conecta Search Console y ejecuta el diagnostico para ver las principales consultas.
                </div>
              )}
            </Section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="CTR organico (GSC)">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-slate-500">Ventana</div>
                  <div className="text-lg font-semibold text-slate-900">{gscWindow ?? 'No definida'}</div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <div className="rounded-xl bg-slate-100 px-3 py-2">
                      <div className="text-xs text-slate-500">Clicks</div>
                      <div className="text-lg font-semibold text-slate-900">{formatNumber(gscClicks)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-100 px-3 py-2">
                      <div className="text-xs text-slate-500">Impresiones</div>
                      <div className="text-lg font-semibold text-slate-900">{formatNumber(gscImpressions)}</div>
                    </div>
                  </div>
                </div>
                <RadialGauge value={gscCtrPercent ?? 0} label="CTR" color="#f97316" />
              </div>
            </Section>
            <Section title="Distribucion de severidad">
              <SeverityPie data={auditCounts} />
            </Section>
          </div>

          <Section title="Recursos mas pesados (PSI)">
            {psiResult && heavyResources > 0 ? (
              <TopHeavyBar items={psiResult.heavy_requests} />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                Ejecuta PageSpeed Insights para obtener el peso de los recursos.
              </div>
            )}
          </Section>

          <div className="grid gap-4 xl:grid-cols-3">
            <Section title="Auditoria tecnica" actions={null}>
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {auditResult ? (
                  <div className="flex flex-wrap gap-6">
                    <span>
                      Issues totales: <strong>{auditResult.count}</strong>
                    </span>
                    <span>
                      Paginas rastreadas: <strong>{auditResult.scanned}</strong>
                    </span>
                  </div>
                ) : (
                  'Ejecuta el diagnostico para ver el detalle del crawl.'
                )}
              </div>
              <div className="mt-4">
                {auditResult ? (
                  <IssuesTable issues={auditResult.issues} />
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                    Aun no hay resultados. Ejecuta la auditoria para listar issues.
                  </div>
                )}
              </div>
            </Section>

            <Section title="On Page SEO Checker">
              {pageAnalysis ? (
                <div className="space-y-3 text-sm text-slate-700">
                  <div>
                    <span className="text-xs uppercase text-slate-500">Title</span>
                    <p className="font-medium text-slate-900">
                      {pageAnalysis.title || 'Sin title'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-slate-500">Meta description</span>
                    <p className="text-slate-900">
                      {pageAnalysis.meta_description || 'Sin description'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs">
                    {totalRecommendations > 0
                      ? `${totalRecommendations} ideas detectadas.`
                      : 'No se detectaron incidencias relevantes.'}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    <p className="font-semibold text-slate-500">Cobertura de keywords:</p>
                    {Object.entries(pageAnalysis.keyword_hits).map(([keyword, hits]) => (
                      <div key={keyword} className="mt-1">
                        {keyword}: {hits > 0 ? `${hits} coincidencia(s)` : 'sin coincidencias'}
                      </div>
                    ))}
                    {totalKeywords === 0 && <p>Sin keywords objetivo configuradas.</p>}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  El diagnostico ejecutara automaticamente el analisis on-page y mostrara los resultados aqui.
                </div>
              )}
            </Section>

            <Section title="PageSpeed Insights">
              {psiResult ? (
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Performance</span>
                    <span className="text-lg font-semibold">
                      {psiResult.performance_score ?? 'n/d'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(psiResult.metrics).map(([metric, value]) => (
                      <div key={metric} className="rounded-lg bg-slate-100 px-3 py-2">
                        <div className="text-slate-500">{metric}</div>
                        <div className="font-semibold text-slate-900">
                          {value !== null ? Math.round(value) : 'n/d'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  El diagnostico mostrara aqui las metricas de PageSpeed.
                </div>
              )}
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
}
