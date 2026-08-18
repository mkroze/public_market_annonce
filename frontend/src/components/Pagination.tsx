interface Props {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pages, total, onPageChange }: Props) {
  if (pages <= 1) return null;

  const range: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  for (let i = start; i <= end; i++) range.push(i);

  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border-subtle)]">
      <span className="text-sm text-[var(--color-slate)] font-sans tabular-nums">
        {total.toLocaleString("fr-FR")} résultat{total !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1">
        <button
          className="px-2.5 py-1.5 text-sm font-sans rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-40 transition-colors"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Précédent
        </button>
        {range.map((p) => (
          <button
            key={p}
            className={`
              w-9 h-9 text-sm font-sans font-medium rounded transition-colors
              ${p === page
                ? "bg-[var(--color-primary)] text-[var(--color-primary-content)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              }
            `}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          className="px-2.5 py-1.5 text-sm font-sans rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-40 transition-colors"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
