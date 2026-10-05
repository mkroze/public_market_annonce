import type { ReactNode } from "react";
import logoFull from "../assets/logo-full.svg";

// Simple centered card for auth utility pages (verify email, password reset).
export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-md rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 shadow-card sm:p-8">
        <img src={logoFull} alt="Marchés Publics Maroc" className="h-6 w-auto" />
        <h1 className="mt-6 font-display text-2xl font-bold text-[var(--color-ink)]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}
