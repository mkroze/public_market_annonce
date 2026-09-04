import { useRef, useState } from "react";
import { MessageSquareText, Send, X, Scale } from "lucide-react";
import { askAssistant } from "../lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const DEFAULT_SUGGESTIONS = [
  "Qu'est-ce que le CPS ?",
  "La caution provisoire est-elle obligatoire ?",
  "Quel délai pour contester mon écartement ?",
];

interface Props {
  procedureName?: string;
  /** `floating` (défaut) = bouton flottant ; `inline` = panneau intégré au flux. */
  variant?: "floating" | "inline";
  /** Suggestions contextualisées ; à défaut, questions génériques. */
  suggestions?: string[];
}

/**
 * Assistant juridique (chat) adossé au décret 2.22.431.
 * Deux présentations : panneau flottant repliable, ou panneau intégré à l'atelier
 * de candidature. Les réponses sont générées côté serveur via /api/assistant/ask.
 */
export default function LegalAssistantSidebar({ procedureName, variant = "floating", suggestions }: Props) {
  const [open, setOpen] = useState(variant === "inline");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prompts = suggestions && suggestions.length ? suggestions : DEFAULT_SUGGESTIONS;

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    setError("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await askAssistant(q, procedureName);
      setMessages((m) => [...m, { role: "assistant", text: res.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'assistant est indisponible.");
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 50);
    }
  }

  const conversation = (
    <>
      {/* Messages */}
      <div ref={scrollRef} className="max-h-96 min-h-48 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-muted)]">
              Posez une question sur la réglementation (pièces exigées, délais, seuils, recours…). Les
              réponses citent l'article applicable et ne constituent pas un conseil juridique.
            </p>
            {prompts.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="block min-h-11 w-full rounded-lg border border-[var(--color-border-subtle)] px-3 py-2 text-left text-xs text-[var(--color-ink)] transition-colors hover:border-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-8 bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                : "mr-4 border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] text-[var(--color-ink)]"
            }`}
          >
            {m.text}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <span className="loading loading-dots loading-sm"></span>
            Consultation du décret…
          </div>
        )}
        {error && (
          <p className="border-l-2 border-[var(--color-danger)] pl-2 text-xs text-[var(--color-danger)]">{error}</p>
        )}
      </div>

      {/* Input */}
      <form
        className="flex items-center gap-2 border-t border-[var(--color-border-subtle)] px-3 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <MessageSquareText size={15} className="shrink-0 text-[var(--color-muted)]" aria-hidden="true" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Votre question…"
          maxLength={500}
          aria-label="Votre question à l'assistant juridique"
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-ink)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Envoyer"
          className="rounded-full p-2 text-[var(--color-primary)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </>
  );

  // Variante intégrée : panneau de section, toujours ouvert, dans le flux normal.
  if (variant === "inline") {
    return (
      <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card">
        <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-4 py-3">
          <Scale size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--color-ink)]">Assistant juridique</p>
            <p className="truncate text-[11px] text-[var(--color-muted)]">
              {procedureName ? `Contexte : ${procedureName}` : "Décret n° 2.22.431 — marchés publics"}
            </p>
          </div>
        </div>
        {conversation}
      </div>
    );
  }

  // Variante flottante : bouton d'appel, puis fenêtre ancrée en bas à droite.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-on-primary)] shadow-lg transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none"
      >
        <Scale size={16} aria-hidden="true" />
        Assistant juridique
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-4 z-40 flex max-h-[calc(100vh-3rem)] w-[min(24rem,calc(100vw-2rem))] flex-col rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-pop sm:right-6">
      <div className="flex items-center gap-2 rounded-t-xl border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-4 py-3">
        <Scale size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-[var(--color-ink)]">Assistant juridique</p>
          <p className="text-[11px] text-[var(--color-muted)]">Décret n° 2.22.431 — marchés publics</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fermer l'assistant"
          className="ml-auto rounded-full p-2 text-[var(--color-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {conversation}
    </div>
  );
}
