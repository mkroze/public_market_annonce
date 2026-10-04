// The live-figures band that sits under the hero.
import { Activity, Hourglass, Landmark, Sparkles } from "lucide-react";
import type { StatsKpis } from "../../lib/types";
import { fmt, useCountUp, useInView } from "./tokens";

function Stat({ value, label, icon: Icon, run }: { value: number; label: string; icon: typeof Activity; run: boolean }) {
  const shown = useCountUp(value, run);
  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <Icon size={18} className="opacity-70" aria-hidden="true" />
      <dd className="mt-3 text-[clamp(2rem,4.4vw,3.25rem)] font-bold leading-none tabular-nums">{fmt(shown)}</dd>
      <dt className="mt-2 text-sm opacity-80">{label}</dt>
    </div>
  );
}

/** The live figures, given the weight of a headline. */
export function LiveStats({ kpis }: { kpis: StatsKpis }) {
  const [ref, inView] = useInView<HTMLElement>();
  const stats = [
    { value: kpis.active, label: "consultations en cours", icon: Activity },
    { value: kpis.new_7d, label: "nouvelles cette semaine", icon: Sparkles },
    { value: kpis.closing_7d, label: "clôturent sous 7 jours", icon: Hourglass },
    { value: kpis.distinct_buyers, label: "acheteurs publics", icon: Landmark },
  ];
  return (
    <section
      ref={ref}
      aria-label="Chiffres en direct"
      className="mx-auto mt-4 max-w-7xl overflow-hidden rounded-[1.75rem] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
    >
      <dl className="grid grid-cols-2 lg:grid-cols-4 [&>div]:border-[color-mix(in_srgb,var(--color-on-primary)_16%,transparent)] [&>div:nth-child(odd)]:border-r lg:[&>div:not(:last-child)]:border-r [&>div:nth-child(-n+2)]:border-b lg:[&>div]:border-b-0">
        {stats.map((stat) => (
          <Stat key={stat.label} {...stat} run={inView} />
        ))}
      </dl>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[color-mix(in_srgb,var(--color-on-primary)_16%,transparent)] px-5 py-3 text-xs opacity-85 sm:px-8">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <span className="h-2 w-2 rounded-full bg-[var(--color-warning)] motion-safe:animate-pulse" aria-hidden="true" />
          Données actualisées quotidiennement
        </span>
        <span>Issues de sources publiques, restructurées pour faciliter la veille.</span>
      </p>
    </section>
  );
}
