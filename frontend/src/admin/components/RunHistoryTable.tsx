import type { ReactNode } from "react";

export interface Column<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

// The shared run-history table used by the Scrape / DCE Cache / DCE Extraction
// pages (previously three near-identical hand-written tables). Column-driven so
// each page just declares its columns. Horizontal-scroll wrapper keeps wide
// tables usable on small screens.
export function RunHistoryTable<T>({
  columns, rows, rowKey, empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-sans">
        <thead>
          <tr className="text-left text-[var(--color-slate)] border-b border-[var(--color-border-subtle)]">
            {columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                className={`px-4 py-2 font-medium ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className ?? ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-ivory-dim)]/40 align-top"
            >
              {columns.map((c, i) => (
                <td
                  key={i}
                  className={`px-4 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className ?? ""}`}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
