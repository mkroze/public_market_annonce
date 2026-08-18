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
      lead="Une question, une suggestion ou une anomalie à signaler ? Écrivez-nous, nous vous répondrons dans les meilleurs délais."
    >
      <div className="not-prose grid gap-8 md:grid-cols-[1fr_1.4fr]">
        {/* Coordonnées */}
        <aside className="space-y-6">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-[var(--color-crimson)] shrink-0 mt-0.5" />
            <div>
              <p className="label-academic">Par e-mail</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-sans text-sm text-[var(--color-charcoal)] hover:text-[var(--color-crimson)]"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-[var(--color-crimson)] shrink-0 mt-0.5" />
            <div>
              <p className="label-academic">Support</p>
              <p className="font-sans text-sm text-[var(--color-slate)]">
                Consultez d'abord la{" "}
                <a href="/faq" className="text-[var(--color-crimson)] underline underline-offset-2">
                  foire aux questions
                </a>
                .
              </p>
            </div>
          </div>
        </aside>

        {/* Formulaire */}
        <div className="border border-[var(--color-border-subtle)] rounded shadow-card bg-[var(--color-ivory)] p-6">
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
                    <span className="label-academic">Nom</span>
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    autoComplete="name"
                    className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-control">
                  <label htmlFor="contact-email" className="label">
                    <span className="label-academic">Email</span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    autoComplete="email"
                    className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
                    placeholder="email@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-control">
                <label htmlFor="contact-subject" className="label">
                  <span className="label-academic">Sujet</span>
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              <div className="form-control">
                <label htmlFor="contact-message" className="label">
                  <span className="label-academic">Message</span>
                </label>
                <textarea
                  id="contact-message"
                  className="textarea textarea-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded min-h-32"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary font-sans font-semibold w-full rounded">
                Envoyer
              </button>
            </form>
          )}
        </div>
      </div>
    </PageShell>
  );
}
