import { useSearchParams } from "react-router-dom";
import OverviewTab from "./stats/OverviewTab";
import Cities from "./Cities";
import Regions from "./Regions";
import Sectors from "./Sectors";

const TABS = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "villes", label: "Villes" },
  { key: "regions", label: "Régions" },
  { key: "secteurs", label: "Secteurs" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Stats() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const active: TabKey =
    raw === "villes" || raw === "regions" || raw === "secteurs" ? raw : "overview";

  function selectTab(key: TabKey) {
    if (key === "overview") {
      setSearchParams({});
    } else {
      setSearchParams({ tab: key });
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">Statistiques</h1>

      <div className="border-b border-[var(--color-border-subtle)] flex gap-1" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => selectTab(tab.key)}
            className={`px-4 py-2 font-sans text-sm transition-colors border-b-2 -mb-px ${
              active === tab.key
                ? "border-[var(--color-crimson)] text-[var(--color-charcoal)] font-semibold"
                : "border-transparent text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "overview" && <OverviewTab />}
      {active === "villes" && <Cities embedded />}
      {active === "regions" && <Regions embedded />}
      {active === "secteurs" && <Sectors embedded />}
    </div>
  );
}
