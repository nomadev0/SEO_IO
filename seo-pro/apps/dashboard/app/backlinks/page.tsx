'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  downloadBacklinksCsv,
  downloadDisavow,
  getBacklinkKpis,
  getBacklinkList,
  getBacklinkSeries,
  type BacklinkFilters,
  type BacklinkKpis,
  type BacklinkRecord,
  type BacklinkSeriesPoint,
} from '../../lib/backlinks';
import { Section } from '../../components/ui/Section';
import { StatCard } from '../../components/ui/StatCard';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Filter, Link2, RefreshCcw } from 'lucide-react';

const PROJECT_ID = 1;
const RANGE_OPTIONS = [
  { label: '7 días', value: '7' as const },
  { label: '30 días', value: '30' as const },
  { label: '90 días', value: '90' as const },
  { label: 'Personalizado', value: 'custom' as const },
];

type RangePreset = (typeof RANGE_OPTIONS)[number]['value'];

type AnchorInsight = {
  anchor: string;
  count: number;
  toxicity: number;
};

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);
const toUtcIso = (value: string) => new Date(`${value}T00:00:00Z`).toISOString();
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

export default function BacklinksDashboardPage() {
  const today = useMemo(() => new Date(), []);
  const [rangePreset, setRangePreset] = useState<RangePreset>('30');
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return { start: toDateInput(start), end: toDateInput(end) };
  });
  const [filters, setFilters] = useState<BacklinkFilters>({
    project_id: PROJECT_ID,
    page: 1,
    page_size: 25,
  });
  const [relFilter, setRelFilter] = useState<'all' | 'follow' | 'nofollow'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'lost' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [kpis, setKpis] = useState<BacklinkKpis | null>(null);
  const [series, setSeries] = useState<BacklinkSeriesPoint[]>([]);
  const [backlinks, setBacklinks] = useState<BacklinkRecord[]>([]);
  const [totalBacklinks, setTotalBacklinks] = useState(0);
  const [selected, setSelected] = useState<BacklinkRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const hasMore = backlinks.length < totalBacklinks;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiData, seriesData, listData] = await Promise.all([
        getBacklinkKpis(PROJECT_ID),
        getBacklinkSeries(PROJECT_ID, toUtcIso(dateRange.start), toUtcIso(dateRange.end)),
        getBacklinkList(filters),
      ]);

      setKpis(kpiData);
      setSeries(seriesData);

      let nextItems: BacklinkRecord[] = [];
      setBacklinks((prev) => {
        nextItems = (filters.page ?? 1) > 1 ? [...prev, ...listData.items] : listData.items;
        return nextItems;
      });
      setTotalBacklinks(listData.total);
      setSelected((prevSelected) => {
        if (!nextItems.length) return null;
        if (!prevSelected) return nextItems[0];
        const match = nextItems.find((item) => item.id === prevSelected.id);
        return match ?? nextItems[0];
      });
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [dateRange.end, dateRange.start, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chartData = useMemo(
    () =>
      series.map((point) => ({
        date: new Date(point.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        nuevos: point.new,
        perdidos: point.lost,
      })),
    [series],
  );

  const anchorInsights = useMemo<AnchorInsight[]>(() => {
    const map = new Map<string, AnchorInsight>();
    backlinks.forEach((item) => {
      if (!item.anchor) return;
      const current = map.get(item.anchor) ?? { anchor: item.anchor, count: 0, toxicity: 0 };
      const nextCount = current.count + 1;
      map.set(item.anchor, {
        anchor: item.anchor,
        count: nextCount,
        toxicity: (current.toxicity * current.count + item.toxicity) / nextCount,
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [backlinks]);

  const handlePresetChange = (value: RangePreset) => {
    setRangePreset(value);
    if (value === 'custom') return;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Number(value));
    setDateRange({ start: toDateInput(start), end: toDateInput(end) });
    setFilters((prev) => ({ ...prev, page: 1 }));
  };

  const applyFilters = () => {
    setFilters((prev) => ({
      ...prev,
      page: 1,
      rel: relFilter === 'all' ? undefined : relFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      q: searchTerm.trim() ? searchTerm.trim() : undefined,
    }));
  };

  const resetFilters = () => {
    setRelFilter('all');
    setStatusFilter('all');
    setSearchTerm('');
    setFilters((prev) => ({
      ...prev,
      page: 1,
      rel: undefined,
      status: undefined,
      q: undefined,
    }));
  };

  const handleLoadMore = () => {
    if (loading || !hasMore) return;
    setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }));
  };

  const handleExport = async (type: 'csv' | 'disavow') => {
    try {
      setExporting(true);
      const exportFilters: BacklinkFilters = { ...filters, page: 1 };
      const blob =
        type === 'csv'
          ? await downloadBacklinksCsv(exportFilters)
          : await downloadDisavow(exportFilters);
      const url = URL.createObjectURL(blob);
      const element = document.createElement('a');
      element.href = url;
      element.download = type === 'csv' ? 'backlinks.csv' : 'disavow.txt';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Exportación fallida: ${message}`);
    } finally {
      setExporting(false);
    }
  };

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      {
        label: 'Backlinks totales',
        value: formatNumber(kpis.total_backlinks),
        delta: `+${formatNumber(kpis.new_30)} (30d)`,
      },
      {
        label: 'Referring domains',
        value: formatNumber(kpis.referring_domains),
      },
      {
        label: 'Nuevos (7d)',
        value: formatNumber(kpis.new_7),
        delta: `30d: ${formatNumber(kpis.new_30)}`,
      },
      {
        label: 'Perdidos (7d)',
        value: formatNumber(kpis.lost_7),
        delta: `30d: ${formatNumber(kpis.lost_30)}`,
      },
      {
        label: '% Follow',
        value: formatDecimal(kpis.follow_ratio) === 'n/d' ? 'n/d' : `${formatDecimal(kpis.follow_ratio)}%`,
      },
      {
        label: 'Toxicidad media',
        value: formatDecimal(kpis.toxicity_avg),
      },
    ];
  }, [kpis]);

  return (
    <div className="min-h-screen bg-[var(--colors-background-default)] pb-24 text-[var(--colors-foreground-default)]">
      <div className="mx-auto max-w-[1180px] space-y-8 px-6 py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--colors-muted-foreground)]">Backlinks</p>
            <h1 className="mt-1 text-3xl font-semibold">Inteligencia de enlaces</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--colors-muted-foreground)]">
              Monitoriza crecimiento, riesgos y oportunidades de tus enlaces entrantes. Ajusta filtros, exporta
              resultados y prioriza el outreach desde un centro de mando unificado.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--colors-border-default)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition hover:bg-[var(--colors-card-default)]"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport('disavow')}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--colors-border-default)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition hover:bg-[var(--colors-card-default)]"
            >
              <Filter className="h-4 w-4" /> Disavow
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <Section
          id="domain-overview"
          title="Resumen de dominio"
          className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {kpiCards.length > 0 ? (
              kpiCards.map((card) => (
                <StatCard key={card.label} label={card.label} value={card.value} delta={card.delta} />
              ))
            ) : (
              <div className="surface-muted rounded-[var(--radius)] p-4 text-xs text-[var(--colors-muted-foreground)]">
                {loading ? 'Cargando métricas de backlinks...' : 'Sin datos disponibles todavía.'}
              </div>
            )}
          </div>
        </Section>

        <Section
          id="organic-research"
          title="Tendencias de nuevos vs perdidos"
          className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
          actions={
            <div className="flex items-center gap-2">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePresetChange(option.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                    rangePreset === option.value
                      ? 'bg-[var(--colors-primary-default)] text-[var(--colors-primary-foreground)]'
                      : 'border border-[var(--colors-border-default)] text-[var(--colors-muted-foreground)] hover:bg-[var(--colors-card-default)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(event) => {
                    setRangePreset('custom');
                    setDateRange((prev) => ({ ...prev, start: event.target.value }));
                    setFilters((prev) => ({ ...prev, page: 1 }));
                  }}
                  max={toDateInput(today)}
                  className="rounded-md border border-[var(--colors-border-default)] bg-transparent px-2 py-1 text-xs"
                />
                <span className="text-xs text-[var(--colors-muted-foreground)]">a</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(event) => {
                    setRangePreset('custom');
                    setDateRange((prev) => ({ ...prev, end: event.target.value }));
                    setFilters((prev) => ({ ...prev, page: 1 }));
                  }}
                  max={toDateInput(today)}
                  className="rounded-md border border-[var(--colors-border-default)] bg-transparent px-2 py-1 text-xs"
                />
              </div>
            </div>
          }
        >
          <div className="h-72 w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[var(--colors-muted-foreground)]">
                {loading ? 'Calculando serie temporal...' : 'Sin actividad en el rango seleccionado.'}
              </div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="areaLost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                  <XAxis dataKey="date" fontSize={12} stroke="currentColor" tickMargin={10} />
                  <YAxis fontSize={12} stroke="currentColor" allowDecimals={false} />
                  <Tooltip labelClassName="text-xs" formatter={(value: number) => formatNumber(value)} />
                  <Area type="monotone" dataKey="nuevos" stroke="#16a34a" fill="url(#areaNew)" strokeWidth={2} />
                  <Area type="monotone" dataKey="perdidos" stroke="#f87171" fill="url(#areaLost)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        <Section
          id="keyword-gap"
          title="Anclas destacadas"
          className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
        >
          {anchorInsights.length === 0 ? (
            <div className="surface-muted rounded-[var(--radius)] p-4 text-xs text-[var(--colors-muted-foreground)]">
              {loading ? 'Procesando anchors...' : 'Ingresa nuevos backlinks para ver patrones de anchor text.'}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {anchorInsights.map((item) => (
                <li
                  key={item.anchor}
                  className="surface-muted rounded-[var(--radius)] border border-[var(--colors-border-default)] p-4"
                >
                  <p className="text-sm font-semibold text-[var(--colors-foreground-default)]">{item.anchor}</p>
                  <p className="mt-1 text-xs text-[var(--colors-muted-foreground)]">
                    {item.count} menciones · Toxicidad media {formatDecimal(item.toxicity)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="backlink-gap"
          title="Explorar backlinks"
          className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadows-md)]"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--colors-muted-foreground)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] px-3 py-1">
              <Link2 className="h-3 w-3" /> {backlinks.length} / {formatNumber(totalBacklinks)} enlaces
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-[var(--colors-border-default)] px-3 py-1 uppercase tracking-[0.2em] text-[var(--colors-muted-foreground)] hover:bg-[var(--colors-card-default)]"
            >
              <RefreshCcw className="h-3 w-3" /> Reset
            </button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em]">Rel</label>
              <select
                value={relFilter}
                onChange={(event) => setRelFilter(event.target.value as typeof relFilter)}
                className="w-full rounded-md border border-[var(--colors-border-default)] bg-transparent px-3 py-2 text-sm"
              >
                <option value="all">Todos</option>
                <option value="follow">Follow</option>
                <option value="nofollow">Nofollow</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em]">Estado</label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="w-full rounded-md border border-[var(--colors-border-default)] bg-transparent px-3 py-2 text-sm"
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="lost">Perdidos</option>
                <option value="pending">Pendientes</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em]">Buscar</label>
              <div className="flex gap-2">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Fuente, destino o anchor"
                  className="flex-1 rounded-md border border-[var(--colors-border-default)] bg-transparent px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={applyFilters}
                  className="rounded-md bg-[var(--colors-primary-default)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--colors-primary-foreground)]"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)]">
            <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)]">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--colors-muted-background)] text-left text-xs uppercase tracking-[0.2em] text-[var(--colors-muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3">Fuente</th>
                    <th className="px-4 py-3">Destino</th>
                    <th className="px-4 py-3">Rel</th>
                    <th className="px-4 py-3">Authority</th>
                    <th className="px-4 py-3">Toxicidad</th>
                    <th className="px-4 py-3">Último evento</th>
                  </tr>
                </thead>
                <tbody>
                  {backlinks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-xs text-[var(--colors-muted-foreground)]">
                        {loading ? 'Cargando backlinks...' : 'No hay enlaces con los filtros seleccionados.'}
                      </td>
                    </tr>
                  ) : (
                    backlinks.map((row) => {
                      const isActive = selected?.id === row.id;
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelected(row)}
                          className={`cursor-pointer border-t border-[var(--colors-border-default)] transition hover:bg-[var(--colors-accent-default)]/20 ${
                            isActive ? 'bg-[var(--colors-primary-default)]/10' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="max-w-[28ch] truncate font-medium text-[var(--colors-foreground-default)]">
                              {row.source_title ?? row.source_url}
                            </div>
                            <div className="text-xs text-[var(--colors-muted-foreground)]">{row.source_url}</div>
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={row.target_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--colors-primary-default)] hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {row.target_url}
                            </a>
                          </td>
                          <td className="px-4 py-3 capitalize">{row.rel}</td>
                          <td className="px-4 py-3">{formatNumber(row.authority)}</td>
                          <td className="px-4 py-3">{formatNumber(row.toxicity)}</td>
                          <td className="px-4 py-3 text-xs text-[var(--colors-muted-foreground)]">
                            {row.latest_event
                              ? `${formatEventLabel(row.latest_event.event_type)} · ${formatDateTime(row.latest_event.event_at)}`
                              : formatDateTime(row.last_seen)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {hasMore && (
                <div className="border-t border-[var(--colors-border-default)] bg-[var(--colors-card-default)] p-3 text-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--colors-primary-default)] hover:underline"
                  >
                    Cargar más
                  </button>
                </div>
              )}
            </div>

            <aside className="surface-muted rounded-[var(--radius)] border border-[var(--colors-border-default)] p-5">
              {selected ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--colors-muted-foreground)]">
                      Fuente
                    </p>
                    <Link
                      href={selected.source_url}
                      target="_blank"
                      className="mt-1 block truncate text-sm font-semibold text-[var(--colors-primary-default)] hover:underline"
                    >
                      {selected.source_title ?? selected.source_url}
                    </Link>
                    <p className="text-xs text-[var(--colors-muted-foreground)]">{selected.source_url}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--colors-muted-foreground)]">Anchor</p>
                    <p className="mt-1 text-sm text-[var(--colors-foreground-default)]">
                      {selected.anchor ?? 'Sin anchor detectado'}
                    </p>
                  </div>
                  <div className="grid gap-2 text-xs text-[var(--colors-muted-foreground)]">
                    <p>
                      <strong className="font-semibold text-[var(--colors-foreground-default)]">Rel:</strong>{' '}
                      {selected.rel}
                    </p>
                    <p>
                      <strong className="font-semibold text-[var(--colors-foreground-default)]">Authority:</strong>{' '}
                      {formatNumber(selected.authority)}
                    </p>
                    <p>
                      <strong className="font-semibold text-[var(--colors-foreground-default)]">Toxicidad:</strong>{' '}
                      {formatNumber(selected.toxicity)}
                    </p>
                    <p>
                      <strong className="font-semibold text-[var(--colors-foreground-default)]">Primera detección:</strong>{' '}
                      {formatDateTime(selected.first_seen)}
                    </p>
                    <p>
                      <strong className="font-semibold text-[var(--colors-foreground-default)]">Última detección:</strong>{' '}
                      {formatDateTime(selected.last_seen)}
                    </p>
                  </div>
                  {selected.context_snippet && (
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--colors-muted-foreground)]">
                        Contexto
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--colors-foreground-default)]">
                        {selected.context_snippet}
                      </p>
                    </div>
                  )}
                  {selected.latest_event && (
                    <div className="rounded-[var(--radius)] border border-[var(--colors-border-default)] bg-[var(--colors-card-default)] p-3 text-xs text-[var(--colors-muted-foreground)]">
                      <p className="font-semibold text-[var(--colors-foreground-default)]">Último evento</p>
                      <p>
                        {formatEventLabel(selected.latest_event.event_type)} ·{' '}
                        {formatDateTime(selected.latest_event.event_at)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[var(--colors-muted-foreground)]">
                  Selecciona un backlink para ver detalles, métricas y contexto del enlace.
                </p>
              )}
            </aside>
          </div>
        </Section>
      </div>
    </div>
  );
}

function formatEventLabel(value: string) {
  switch (value) {
    case 'new':
      return 'Nuevo';
    case 'lost':
      return 'Perdido';
    case 'changed':
      return 'Actualizado';
    case 'recovered':
      return 'Recuperado';
    default:
      return value;
  }
}
