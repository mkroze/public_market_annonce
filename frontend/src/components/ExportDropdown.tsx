import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileJson, FileText, ChevronDown } from "lucide-react";

interface Props {
  total: number;
  onExport: (format: "csv" | "excel" | "json") => Promise<void>;
}

const FORMATS = [
  { key: "csv" as const, label: "CSV", sublabel: "Standard", icon: FileText },
  { key: "excel" as const, label: "Excel", sublabel: "Compatible FR", icon: FileSpreadsheet },
  { key: "json" as const, label: "JSON", sublabel: "Developpeurs", icon: FileJson },
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
          border transition-all duration-150
          ${isExporting
            ? "border-[var(--color-border-subtle)] text-[var(--color-slate)] cursor-wait"
            : "border-[var(--color-crimson)] text-[var(--color-crimson)] hover:bg-[var(--color-crimson)] hover:text-white cursor-pointer"
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
            <ChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-56 bg-base-100 border border-[var(--color-border-subtle)] rounded shadow-sm z-50 animate-in"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-[var(--color-border-subtle)]">
            <p className="label-academic tabular-nums">
              {total.toLocaleString("fr-FR")} resultats
            </p>
          </div>
          {FORMATS.map((f) => (
            <button
              key={f.key}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-ivory-dim)] transition-colors duration-100 cursor-pointer focus:bg-[var(--color-ivory-dim)] focus:outline-none"
              onClick={() => handleExport(f.key)}
              role="menuitem"
            >
              <f.icon size={16} className="text-[var(--color-crimson)] shrink-0" />
              <div>
                <div className="text-sm font-medium font-sans text-[var(--color-charcoal)]">{f.label}</div>
                <div className="text-xs text-[var(--color-slate)]">{f.sublabel}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
