import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import EmptyState from "../../components/EmptyState";

export default function MemberSavedSearches() {
  return (
    <div className="space-y-6">
      <header>
        <p className="editorial-label text-[var(--color-muted)]">Espace membre</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-[var(--color-ink)]">
          <Search size={22} aria-hidden />
          Recherches enregistrées
        </h1>
      </header>

      <EmptyState
        size="md"
        icon={Search}
        title="Aucune recherche enregistrée"
        description="Les recherches enregistrées seront ajoutées à cet espace. En attendant, le catalogue reste le point de départ pour filtrer les consultations."
        action={
          <Link
            to="/tenders"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
          >
            Ouvrir le catalogue
          </Link>
        }
      />
    </div>
  );
}
