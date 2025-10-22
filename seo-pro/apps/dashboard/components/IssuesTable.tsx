'use client';

import { useMemo, useState } from 'react';
import type { Issue } from '../lib/api';

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
type Severity = (typeof SEVERITIES)[number];

const SEVERITY_CLASS: Record<Severity, string> = {
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-amber-100 text-amber-700',
  Medium: 'bg-blue-100 text-blue-700',
  Low: 'bg-neutral-100 text-neutral-700',
};

type SortKey = 'severity' | 'rule' | 'url';

export default function IssuesTable({ issues }: { issues: Issue[] }) {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<'' | Severity>('');
  const [sortKey, setSortKey] = useState<SortKey>('severity');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const severityIndex = (value: Severity) => SEVERITIES.indexOf(value);

    return issues
      .filter((issue) => (severity ? issue.severity === severity : true))
      .filter((issue) => {
        if (!needle) {
          return true;
        }
        return (
          issue.url.toLowerCase().includes(needle) ||
          issue.rule.toLowerCase().includes(needle) ||
          issue.description.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        if (sortKey === 'severity') {
          return severityIndex(a.severity) - severityIndex(b.severity);
        }
        if (sortKey === 'rule') {
          return a.rule.localeCompare(b.rule);
        }
        return a.url.localeCompare(b.url);
      });
  }, [issues, query, severity, sortKey]);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por URL, regla o descripcion"
          className="w-full rounded-lg border px-3 py-2 text-sm md:w-72"
        />
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value as '' | Severity)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Todas las severidades</option>
          {SEVERITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as SortKey)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="severity">Ordenar por severidad</option>
          <option value="rule">Ordenar por regla</option>
          <option value="url">Ordenar por URL</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-neutral-500">
              <th className="py-2 pr-3">Severidad</th>
              <th className="py-2 pr-3">Regla</th>
              <th className="py-2 pr-3">URL</th>
              <th className="py-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((issue) => (
              <tr key={`${issue.rule}-${issue.url}`} className="border-b last:border-0">
                <td className="py-2 pr-3 align-top">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASS[issue.severity]}`}
                  >
                    {issue.severity}
                  </span>
                </td>
                <td className="py-2 pr-3 align-top">
                  <div className="font-medium text-neutral-800">{issue.rule}</div>
                  <div className="text-xs text-neutral-500">{issue.description}</div>
                </td>
                <td className="break-all py-2 pr-3 align-top">
                  <a className="text-blue-700 underline" href={issue.url} target="_blank" rel="noreferrer">
                    {issue.url}
                  </a>
                </td>
                <td className="py-2 align-top text-xs text-neutral-600">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(issue.evidence, null, 2)}</pre>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-neutral-500">
                  Sin coincidencias con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
