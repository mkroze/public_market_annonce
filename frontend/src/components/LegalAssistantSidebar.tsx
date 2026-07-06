import { useRef, useState } from "react";
import { MessageSquareText, Send, X, Scale } from "lucide-react";
import { askAssistant } from "../lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "Qu'est-ce que le CPS ?",
  "La caution provisoire est-elle obligatoire ?",
  "Quel délai pour contester mon écartement ?",
];

/**
 * Assistant juridique (chat) adossé au décret 2.22.431 — panneau repliable.
 * Les réponses sont générées côté serveur via /api/assistant/ask.
 */
export default function LegalAssistantSidebar({ procedureName }: { procedureName?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-[var(--color-crimson)] text-white font-sans text-sm font-semibold shadow-lg hover:opacity-90 transition-opacity"
      >
        <Scale size={16} />
        Assistant juridique
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[min(24rem,calc(100vw-2rem))] flex flex-col rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] rounded-t">
        <Scale size={16} className="text-[var(--color-crimson)]" />
        <div>
          <p className="font-display text-sm font-bold text-[var(--color-charcoal)]">Assistant juridique</p>
          <p className="font-sans text-[11px] text-[var(--color-slate)]">Décret n° 2.22.431 — marchés publics</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fermer l'assistant"
          className="ml-auto text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 max-h-96 min-h-48 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="font-sans text-xs text-[var(--color-slate)]">
              Posez une question sur la réglementation (pièces exigées, délais, seuils, recours…). Les
              réponses citent l'article applicable et ne constituent pas un conseil juridique.
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="block w-full text-left px-3 py-2 rounded border border-[var(--color-border-subtle)] font-sans text-xs text-[var(--color-charcoal)] hover:border-[var(--color-crimson)] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`font-sans text-sm leading-relaxed whitespace-pre-wrap rounded px-3 py-2 ${
              m.role === "user"
                ? "bg-[var(--color-crimson)] text-white ml-8"
                : "bg-[var(--color-ivory-dim)] text-[var(--color-charcoal)] mr-4 border border-[var(--color-border-subtle)]"
            }`}
          >
            {m.text}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 font-sans text-xs text-[var(--color-slate)]">
            <span className="loading loading-dots loading-sm"></span>
            Consultation du décret…
          </div>
        )}
        {error && (
          <p className="font-sans text-xs text-[var(--color-crimson)] border-l-2 border-[var(--color-crimson)] pl-2">
            {error}
          </p>
        )}
      </div>

      {/* Input */}
      <form
        className="flex items-center gap-2 px-3 py-3 border-t border-[var(--color-border-subtle)]"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <MessageSquareText size={15} className="text-[var(--color-slate)] shrink-0" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Votre question…"
          maxLength={500}
          className="flex-1 min-w-0 bg-transparent font-sans text-sm text-[var(--color-charcoal)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Envoyer"
          className="text-[var(--color-crimson)] disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
