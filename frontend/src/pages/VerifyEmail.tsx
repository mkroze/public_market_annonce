import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { verifyEmail } from "../lib/api";
import { useAuth } from "../lib/auth";
import AuthCard from "../components/AuthCard";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { user, updateUser } = useAuth();
  const [state, setState] = useState<"verifying" | "success" | "error">("verifying");
  const ran = useRef(false);

  useEffect(() => {
    // Guard against the double-invoke of effects in React strict mode: a
    // verification token is single-use, so a second call would fail.
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setState("error");
      return;
    }
    verifyEmail(token)
      .then(() => {
        setState("success");
        updateUser({ email_verified: true });
      })
      .catch(() => setState("error"));
  }, [token, updateUser]);

  return (
    <AuthCard title="Vérification de l'email">
      {state === "verifying" && (
        <p className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <Loader2 size={18} className="animate-spin" /> Vérification en cours…
        </p>
      )}
      {state === "success" && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
            <CheckCircle2 size={18} className="text-[var(--color-primary)]" /> Votre adresse email est confirmée.
          </p>
          <Link
            to={user ? "/member/overview" : "/login"}
            className="btn btn-primary btn-sm rounded font-sans font-semibold"
          >
            {user ? "Aller à mon espace" : "Se connecter"}
          </Link>
        </div>
      )}
      {state === "error" && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
            <XCircle size={18} className="text-[var(--color-accent)]" /> Ce lien de vérification est invalide ou expiré.
          </p>
          <p className="text-sm text-[var(--color-muted)]">
            {user
              ? "Vous pouvez renvoyer un email de vérification depuis le bandeau en haut de page."
              : "Connectez-vous, puis renvoyez un email de vérification."}
          </p>
          <Link
            to={user ? "/tenders" : "/login"}
            className="text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            {user ? "Retour au catalogue" : "Se connecter"}
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
