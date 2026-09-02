import { useState } from "react";
import { MailWarning, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { resendVerification } from "../lib/api";

// Non-blocking reminder shown to logged-in users whose email isn't verified yet.
// It never gates the catalog or DCE — it just nudges + offers a resend.
export default function VerificationBanner() {
  const { user, updateUser } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!user || user.email_verified !== false || dismissed) return null;

  async function handleResend() {
    setStatus("sending");
    try {
      const res = await resendVerification();
      if (res.already_verified) {
        updateUser({ email_verified: true });
        return;
      }
      setStatus(res.verification_email_sent ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="border-b border-[var(--color-border-subtle)] bg-[var(--color-accent-soft)]">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2 sm:px-6">
        <MailWarning size={16} className="shrink-0 text-[var(--color-primary)]" />
        <p className="flex-1 font-sans text-sm text-[var(--color-ink)]">
          {status === "sent"
            ? "Email de vérification renvoyé. Vérifiez votre boîte de réception."
            : status === "error"
              ? "Envoi impossible pour le moment. Réessayez plus tard."
              : "Confirmez votre adresse email pour sécuriser votre compte."}
        </p>
        {status !== "sent" && (
          <button
            type="button"
            onClick={handleResend}
            disabled={status === "sending"}
            className="shrink-0 font-sans text-sm font-semibold text-[var(--color-primary)] hover:underline disabled:opacity-60"
          >
            {status === "sending" ? "Envoi..." : "Renvoyer l'email"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Masquer le rappel"
          className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
