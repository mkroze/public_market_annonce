import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

/**
 * État vide unifié : pastille d'icône, titre net, explication plus douce, action
 * optionnelle. Compact par défaut (`sm`) pour ne pas ouvrir un grand panneau
 * blanc quand le contenu est simple. Utilisé public + admin.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "sm",
  bordered = true,
  className = "",
}: {
  icon?: ComponentType<LucideProps>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  size?: "sm" | "md";
  bordered?: boolean;
  className?: string;
}) {
  const pad = size === "md" ? "px-6 py-12" : "px-5 py-8";
  const frame = bordered
    ? "rounded-[1.25rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface)]"
    : "";
  return (
    <div className={`flex flex-col items-center justify-center text-center ${pad} ${frame} ${className}`}>
      {Icon && (
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-primary)]">
          <Icon size={20} aria-hidden />
        </span>
      )}
      <p className="text-[15px] font-bold text-[var(--color-ink)]">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
