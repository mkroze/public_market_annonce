import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  const visibleItems = items.filter((item) => item.label.trim());

  return (
    <nav
      aria-label="Fil d'Ariane"
      className={`text-xs font-sans text-[var(--color-muted)] ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link to="/tenders" className="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors motion-reduce:transition-none">
            Accueil
          </Link>
        </li>
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight size={12} className="shrink-0 opacity-60" aria-hidden="true" />
              {item.to && !isLast ? (
                <Link to={item.to} className="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors motion-reduce:transition-none">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={`min-w-0 truncate ${isLast ? "text-[var(--color-ink)]" : ""}`}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
