import { useState, type FormEvent } from "react";
import { Mail, MessageSquare, CheckCircle } from "lucide-react";
import PageShell from "../components/PageShell";

const CONTACT_EMAIL = "contact@marchespublics.ma";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  // Aucun backend de contact n'est exposé : on ouvre le client mail de
  // l'utilisateur avec le message pré-rempli. On ne peut pas garantir que le
  // client s'ouvre, donc l'écran de confirmation reste prudent et fournit un
  // lien mailto de secours.
  function buildMailto(): string {
    const body = `Nom : ${name}\nEmail : ${email}\n\n${message}`;
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      subject || "Contact",
    )}&body=${encodeURIComponent(body)}`;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    window.location.href = buildMailto();
    setSent(true);
  }

  return (
    <PageShell
      title="Contact"
      section="Aide"
      width="wide"
      lead="Une question, une suggestion ou une anomalie à signaler ? Écrivez-nous, nous vous répondrons dans les meilleurs délais."
    >
      {/* Une seule surface, deux colonnes : coordonnées à gauche, formulaire à
          droite — plus de carte dans la carte. */}
      <div className="not-prose institutional-panel grid gap-8 p-6 sm:p-8 md:grid-cols-[0.85fr_1.4fr] md:gap-10 md:divide-x md:divide-[var(--color-border-subtle)]">
        {/* Coordonnées */}
        <aside className="space-y-5 md:pr-2">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-primary)]">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">Par e-mail</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-sans text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-primary)]"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-primary)]">
              <MessageSquare className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">Support</p>
              <p className="font-sans text-sm text-[var(--color-muted)]">
                Consultez d'abord la{" "}
                <a href="/faq" className="text-[var(--color-primary)] underline underline-offset-2">
                  foire aux questions
                </a>
                .
              </p>
            </div>
          </div>
        </aside>

        {/* Formulaire — pas de carte imbriquée, il occupe la colonne */}
        <div className="md:pl-8">
          {sent ? (
            <div className="flex flex-col items-center text-center py-8">
              <CheckCircle className="w-10 h-10 text-[var(--color-crimson)] mb-3" />
              <p className="font-display text-xl text-[var(--color-charcoal)]">Message préparé</p>
              <p className="font-sans text-sm text-[var(--color-slate)] mt-2 max-w-xs">
                Votre logiciel de messagerie devrait s'être ouvert avec le message pré-rempli&nbsp;:
                finalisez l'envoi depuis celui-ci.
              </p>
              <p className="font-sans text-sm text-[var(--color-slate)] mt-2 max-w-xs">
                Rien ne s'est ouvert ?{" "}
                <a href={buildMailto()} className="text-[var(--color-crimson)] underline underline-offset-2">
                  Rouvrir le brouillon
                </a>{" "}
                ou écrivez directement à{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--color-crimson)] underline underline-offset-2">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="btn btn-ghost btn-sm mt-4 font-sans"
              >
                Rédiger un autre message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="form-control">
                  <label htmlFor="contact-name" className="label">
                    <span className="text-[13px] font-semibold text-[var(--color-ink)]">Nom</span>
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    autoComplete="name"
                    className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded-lg"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-control">
                  <label htmlFor="contact-email" className="label">
                    <span className="text-[13px] font-semibold text-[var(--color-ink)]">Email</span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    autoComplete="email"
                    className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded-lg"
                    placeholder="email@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-control">
                <label htmlFor="contact-subject" className="label">
                  <span className="text-[13px] font-semibold text-[var(--color-ink)]">Sujet</span>
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded-lg"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              <div className="form-control">
                <label htmlFor="contact-message" className="label">
                  <span className="text-[13px] font-semibold text-[var(--color-ink)]">Message</span>
                </label>
                <textarea
                  id="contact-message"
                  className="textarea textarea-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded-lg min-h-32"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary font-sans font-semibold w-full rounded-lg">
                Envoyer
              </button>
            </form>
          )}
        </div>
      </div>
    </PageShell>
  );
}
