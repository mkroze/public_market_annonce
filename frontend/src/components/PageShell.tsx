import { useEffect, type ReactNode } from "react";
import type { BreadcrumbItem } from "./Breadcrumbs";

interface PageShellProps {
  title: string;
  lead?: string;
  section?: string;
  updatedAt?: string;
  breadcrumbs?: BreadcrumbItem[];
  width?: "prose" | "wide";
  children: ReactNode;
}

export default function PageShell({ title, lead, section, updatedAt, width = "prose", children }: PageShellProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="px-4 py-7 sm:px-6 sm:py-10">
      <div className={`mx-auto ${width === "wide" ? "max-w-6xl" : "max-w-3xl"}`}>
        <header className="mb-8 sm:mb-10">
          {section && (
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted-light)]">
              {section}
            </p>
          )}
          <h1 className="max-w-4xl text-[clamp(2.2rem,5vw,4.8rem)] font-semibold leading-[1.02] tracking-[0] text-[var(--color-ink)]">
            {title}
          </h1>
          {lead && (
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg">
              {lead}
            </p>
          )}
          {updatedAt && (
            <p className="mt-4 text-xs text-[var(--color-muted-light)]">
              Mis à jour le {updatedAt}
            </p>
          )}
        </header>

        <article className="font-sans leading-relaxed text-[var(--color-ink)] [&_a]:text-[var(--color-primary)] [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-7 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:text-[var(--color-muted)] [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:mb-4 [&_p]:text-[var(--color-muted)] [&_strong]:font-semibold [&_strong]:text-[var(--color-ink)] [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </article>
      </div>
    </div>
  );
}
