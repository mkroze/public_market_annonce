import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { getFavorites, removeFavorite } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Tender } from "../lib/types";

export default function Favorites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) fetchFavorites();
  }, [user]);

  async function fetchFavorites() {
    setLoading(true);
    try {
      const res = await getFavorites();
      setFavorites(res.data);
    } catch {
      setError("Erreur lors du chargement des favoris");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeFavorite(id);
      setFavorites((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError("Erreur lors de la suppression");
    }
  }

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-8 text-center">
          <Heart className="w-12 h-12 mx-auto mb-4 text-[var(--color-slate)]" />
          <p className="text-lg mb-4 font-sans text-[var(--color-charcoal)]">Connectez-vous pour voir vos favoris.</p>
          <Link to="/login" className="btn btn-primary font-sans font-semibold rounded">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl text-[var(--color-charcoal)] flex items-center gap-2 mb-6">
        <Heart className="w-6 h-6 text-[var(--color-crimson)]" />
        Mes consultations sauvegard&eacute;es
      </h1>

      {error && (
        <div className="border border-[var(--color-border-subtle)] border-l-4 border-l-[var(--color-crimson)] rounded bg-[var(--color-ivory-dim)] p-3 mb-4">
          <span className="font-sans text-sm text-[var(--color-charcoal)]">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]"></span>
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-slate)]">
          <Heart className="w-12 h-12 mx-auto mb-4" />
          <p className="font-sans">Aucune consultation sauvegard&eacute;e</p>
        </div>
      ) : (
        <div className="border border-[var(--color-border-subtle)] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="bg-[var(--color-ivory-deep)] border-b border-[var(--color-border)]">
                  <th className="label-academic font-sans text-[var(--color-slate)]">Titre</th>
                  <th className="label-academic font-sans text-[var(--color-slate)]">Entit&eacute;</th>
                  <th className="label-academic font-sans text-[var(--color-slate)]">Lieu</th>
                  <th className="label-academic font-sans text-[var(--color-slate)]">Date limite</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {favorites.map((tender) => (
                  <tr
                    key={tender.id}
                    className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-ivory-dim)] cursor-pointer transition-colors"
                    onClick={() => navigate(`/tenders/${tender.id}`)}
                  >
                    <td className="max-w-xs truncate font-sans text-[var(--color-charcoal)]">{tender.title}</td>
                    <td className="max-w-[200px] truncate font-sans text-[var(--color-slate)]">{tender.entity}</td>
                    <td className="font-sans text-[var(--color-slate)]">{tender.location}</td>
                    <td className="font-sans text-[var(--color-slate)]">{tender.deadline}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm btn-square text-[var(--color-crimson)] hover:bg-[var(--color-ivory-dim)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(tender.id);
                        }}
                        title="Retirer des favoris"
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
