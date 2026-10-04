import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check } from "lucide-react";
import { useAuth } from "../lib/auth";
import ThemeToggle from "../components/ThemeToggle";
import { getStats, getTenders } from "../lib/api";
import type { StatsResponse, Tender } from "../lib/types";
import { HeroVideo } from "./home/HeroVideo";
import { LiveStats } from "./home/LiveStats";
import { ProductStory } from "./home/ProductStory";
import {
  AudienceSection, BeforeAfterSection, BenefitsSection, DataSection, FaqSection, FinalCta, StickyCta,
} from "./home/sections";
import { CTA_PRIMARY, CTA_SECONDARY, FRAME, REASSURANCE, SAMPLE_TENDERS, type PrimaryCta } from "./home/tokens";
import { Pill } from "./home/ui";

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  // null until the catalog answered; stays null (illustrative preview) if it can't.
  const [tenders, setTenders] = useState<Tender[] | null>(null);

  const heroCtaRef = useRef<HTMLDivElement>(null);
  const finalCtaRef = useRef<HTMLElement>(null);
  const [heroCtaVisible, setHeroCtaVisible] = useState(true);
  const [reachedFinalCta, setReachedFinalCta] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Live proof is a bonus: on failure the page keeps its illustrative form.
    getStats().then(setStats).catch(() => setStats(null));
    getTenders({ per_page: 4 })
      .then((res) => setTenders(res.data.length > 0 ? res.data : null))
      .catch(() => setTenders(null));
  }, []);

  // The mobile sticky CTA shows between the hero's buttons and the final CTA.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const hero = new IntersectionObserver(([entry]) => setHeroCtaVisible(entry.isIntersecting));
    const final = new IntersectionObserver(([entry]) =>
      setReachedFinalCta(entry.isIntersecting || entry.boundingClientRect.top < 0),
    );
    if (heroCtaRef.current) hero.observe(heroCtaRef.current);
    if (finalCtaRef.current) final.observe(finalCtaRef.current);
    return () => {
      hero.disconnect();
      final.disconnect();
    };
  }, []);

  const cta: PrimaryCta = user
    ? { to: "/member/overview", label: "Ouvrir mon espace" }
    : { to: "/register", label: "Créer mon compte gratuit" };

  const live = tenders !== null;
  const shown = tenders ?? SAMPLE_TENDERS;

  return (
    <div className="px-3 py-3 sm:px-5 sm:py-4">
      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section className={`relative mx-auto ${FRAME}`} aria-labelledby="home-hero-title">
        <ThemeToggle className="absolute right-4 top-4 z-10 sm:right-5 sm:top-5" />
        <div className="px-5 pb-8 pt-16 sm:px-8 sm:pb-12 sm:pt-12">
          <div className="mx-auto max-w-3xl text-center stagger">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-success)]" aria-hidden="true" />
              Marchés publics du Maroc · mis à jour chaque jour
            </div>

            <h1
              id="home-hero-title"
              className="text-[clamp(2.1rem,4.4vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.01em] text-[var(--color-ink)]"
            >
              Ne ratez plus <Pill>aucun marché public</Pill> fait pour vous.
            </h1>

            <p className="mx-auto mt-5 max-w-[42rem] text-balance text-base leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">
              Les appels d'offres publics réunis, filtrables et suivis par alerte e-mail.
            </p>

            <div ref={heroCtaRef} className="mt-7 flex flex-col justify-center gap-3 sm:flex-row sm:items-center">
              <Link to={cta.to} className={CTA_PRIMARY}>
                {cta.label}
                <ArrowUpRight size={17} className="text-[var(--color-warning)]" aria-hidden="true" />
              </Link>
              <Link to="/tenders" className={CTA_SECONDARY}>
                Voir les consultations
              </Link>
            </div>

            {!user && (
              <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-[var(--color-muted)]">
                {REASSURANCE.map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <Check size={15} className="text-[var(--color-success)]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mx-auto mt-8 max-w-5xl rise-in sm:mt-10">
            <HeroVideo />
            <p className="mt-3 text-center text-xs text-[var(--color-muted-light)]">
              Enregistrement réel de l'application, sur des consultations publiées.
            </p>
          </div>
        </div>
      </section>

      {stats?.kpis && <LiveStats kpis={stats.kpis} />}

      <ProductStory />
      <BenefitsSection stats={stats} tenders={shown} live={live} />
      <BeforeAfterSection />
      <DataSection stats={stats} />
      <AudienceSection stats={stats} />
      <FaqSection />
      <FinalCta cta={cta} showReassurance={!user} sentinelRef={finalCtaRef} />

      {!user && <StickyCta cta={cta} visible={!heroCtaVisible && !reachedFinalCta} />}
    </div>
  );
}
