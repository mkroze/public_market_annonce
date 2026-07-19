import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Scale, ShieldCheck, Calculator as CalcIcon, Sparkles, Gavel } from "lucide-react";
import Procedures from "./Procedures";
import Eligibility from "./Eligibility";
import Calculator from "./Calculator";
import CandidacyAssistant from "./CandidacyAssistant";
import Recours from "./Recours";

const SECTIONS = [
  { id: "procedures", label: "Procédures", icon: Scale },
  { id: "eligibilite", label: "Éligibilité", icon: ShieldCheck },
  { id: "calculateur", label: "Calculateurs", icon: CalcIcon },
  { id: "assistant", label: "Assistant", icon: Sparkles },
  { id: "recours", label: "Recours", icon: Gavel },
] as const;

export default function Guide() {
  const [active, setActive] = useState<string>("procedures");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <Scale className="w-6 h-6 text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
            Guide & Outils
          </h1>
        </div>
        <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
          De la procédure au recours : comprendre le mode de passation, vérifier votre éligibilité,
          chiffrer pénalités et cautions, préparer votre dossier et connaître vos voies de recours.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-8">
        <nav className="hidden lg:block" aria-label="Sommaire">
          <ul className="sticky top-6 space-y-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex items-center gap-2 px-3 py-2 rounded font-sans text-sm transition-colors ${
                      isActive
                        ? "bg-[var(--color-ivory-dim)] text-[var(--color-crimson)] font-semibold"
                        : "text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
                    }`}
                  >
                    <Icon
                      size={15}
                      className={isActive ? "text-[var(--color-crimson)]" : "text-[var(--color-slate)]"}
                    />
                    {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-14 min-w-0">
          <section id="procedures" className="scroll-mt-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-4">
              Procédures de passation
            </h2>
            <Procedures embedded />
          </section>

          <section id="eligibilite" className="scroll-mt-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-4">
              Vérificateur d'éligibilité
            </h2>
            <Eligibility embedded />
          </section>

          <section id="calculateur" className="scroll-mt-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-4">
              Calculateurs
            </h2>
            <Calculator embedded />
          </section>

          <section id="assistant" className="scroll-mt-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-2">
              Assistant candidature
            </h2>
            <p className="font-sans text-sm text-[var(--color-slate)] mb-4">
              Renseignez votre marché ci-dessous, ou{" "}
              <Link to="/tenders" className="text-[var(--color-crimson)] hover:underline">
                ouvrez une consultation
              </Link>{" "}
              pour l'analyser automatiquement.
            </p>
            <CandidacyAssistant embedded />
          </section>

          <section id="recours" className="scroll-mt-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-4">
              Assistant recours
            </h2>
            <Recours embedded />
          </section>
        </div>
      </div>
    </div>
  );
}
