import { ReactNode } from 'react';

type SimpleColumns = string[];
type SimpleRows = (ReactNode[])[];

type ColumnDef = {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row: any) => ReactNode;
};

type SmartProps = {
  columns: ColumnDef[];
  rows: any[];                // objetos o arrays
  rowKey?: string;            // si quieres key estable
};

type SimpleProps = {
  columns: SimpleColumns;
  rows: SimpleRows;           // arrays de celdas
};

type Props = SimpleProps | SmartProps;

function isSmartProps(p: Props): p is SmartProps {
  return Array.isArray((p as SmartProps).columns) && typeof (p as any).columns[0] === 'object';
}

export function Table(props: Props) {
  if (isSmartProps(props)) {
    const { columns, rows, rowKey } = props;

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-500 dark:text-white/60">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-2 font-medium ${alignClass(c.align)}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const key = rowKey ? r?.[rowKey] ?? i : i;
              const isArray = Array.isArray(r);
              return (
                <tr key={key} className="border-t border-gray-100 dark:border-white/10">
                  {isArray
                    ? // si viene como array, úsalo tal cual
                      (r as ReactNode[]).map((cell, j) => (
                        <td key={j} className="px-3 py-2">{cell}</td>
                      ))
                    : // si viene como objeto, pinta según columnas
                      columns.map((c) => {
                        const raw = (r as any)?.[c.key];
                        const value = c.format ? c.format(raw, r) : raw;
                        return (
                          <td key={c.key} className={`px-3 py-2 ${alignClass(c.align)}`}>
                            {value as ReactNode}
                          </td>
                        );
                      })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Modo simple (tu versión original)
  const { columns, rows } = props as SimpleProps;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-gray-500 dark:text-white/60">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className="px-3 py-2 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100 dark:border-white/10">
              {Array.isArray(r)
                ? r.map((cell, j) => <td key={j} className="px-3 py-2">{cell}</td>)
                : <td className="px-3 py-2" colSpan={columns.length}>Fila inválida</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function alignClass(align?: 'left' | 'center' | 'right') {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}
