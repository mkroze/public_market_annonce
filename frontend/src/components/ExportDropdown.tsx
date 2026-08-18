import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileJson, FileText, ChevronDown } from "lucide-react";

interface Props {
  total: number;
  onExport: (format: "csv" | "excel" | "json") => Promise<void>;
}

const FORMATS = [
  { key: "csv" as const, label: "CSV", sublabel: "Standard", icon: FileText },
  { key: "excel" as const, label: "Excel", sublabel: "Compatible FR", icon: FileSpreadsheet },
  { key: "json" as const, label: "JSON", sublabel: "Développeurs", icon: FileJson },
];

export default function ExportDropdown({ total, onExport }: Props) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  async function handleExport(format: "csv" | "excel" | "json") {
    setExporting(format);
    setOpen(false);
    try {
      await onExport(format);
    } finally {
      setExporting(null);
    }
  }

  const isExporting = exporting !== null;

  return (
    <div className="relative" ref={ref}>
      <button
        className={`
          flex items-center gap-2 px-3.5 py-2 text-sm font-sans font-medium rounded
          border transition-colors duration-150 motion-reduce:transition-none
          ${isExporting
            ? "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] cursor-wait"
            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] cursor-pointer"
          }
        `}
        onClick={() => setOpen(!open)}
        disabled={isExporting || total === 0}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {isExporting ? (
          <>
            <span className="loading loading-spinner loading-xs"></span>
            <span>Export...</span>
          </>
        ) : (
          <>
            <Download size={15} />
            <span>Exporter</span>
            <ChevronDown size={14} className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-pop z-50 animate-in"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-[var(--color-border-subtle)]">
            <p className="label-academic tabular-nums">
              {total.toLocaleString("fr-FR")} résultats
            </p>
          </div>
          {FORMATS.map((f) => (
            <button
              key={f.key}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-surface-muted)] transition-colors duration-100 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] motion-reduce:transition-none"
              onClick={() => handleExport(f.key)}
              role="menuitem"
            >
              <f.icon size={16} className="text-[var(--color-primary)] shrink-0" />
              <div>
                <div className="text-sm font-medium font-sans text-[var(--color-ink)]">{f.label}</div>
                <div className="text-xs text-[var(--color-muted)]">{f.sublabel}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
