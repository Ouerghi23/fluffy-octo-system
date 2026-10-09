import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Database, RotateCcw, Sparkles } from "lucide-react";
import { api, type ChatMessage } from "../lib/api";

type Message = ChatMessage & { tools?: string[]; error?: boolean };

const TOOL_LABELS: Record<string, string> = {
  get_farm_overview: "Vue d'ensemble",
  get_milk_production: "Production",
  get_cow_ranking: "Classement",
  get_production_changes: "Évolutions",
  find_cows: "Recherche",
  get_cow_details: "Fiche vache",
  get_health_events: "Santé",
  get_expenses: "Dépenses",
};

const SUGGESTIONS = [
  { title: "Résumé", prompt: "Donne-moi un résumé de la ferme." },
  { title: "Baisses de production", prompt: "Quelles vaches ont eu une baisse de production cette semaine, et pourquoi ?" },
  { title: "Meilleure productrice", prompt: "Quelle vache produit le plus ce mois-ci ?" },
  { title: "Dépenses", prompt: "Combien avons-nous dépensé en alimentation ce mois-ci ?" },
  { title: "Santé", prompt: "Y a-t-il eu des problèmes de santé ces 30 derniers jours ?" },
  { title: "Recherche", prompt: "Montre-moi les vaches Holstein qui produisent moins de 25 L par jour." },
];

const md: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-forest-900">{children}</strong>,
  h1: ({ children }) => <h3 className="mb-2 mt-4 font-display text-lg text-forest-900 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-4 font-display text-lg text-forest-900 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-2 mt-3 font-semibold text-forest-900 first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 marker:text-wheat-600 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 marker:text-wheat-600 last:mb-0">{children}</ol>,
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto rounded-xl border border-cream-200 last:mb-0">
      <table className="w-full text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-cream-100">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 font-semibold uppercase tracking-wider text-bark-600">{children}</th>
  ),
  td: ({ children }) => <td className="border-t border-cream-200 px-3 py-2">{children}</td>,
  code: ({ children }) => <code className="rounded bg-cream-200 px-1 py-0.5 text-[0.85em]">{children}</code>,
};

function AiAvatar() {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-wheat-300 to-wheat-600 text-forest-950 shadow-md">
      <Sparkles size={16} />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex animate-fade-up gap-3">
      <AiAvatar />
      <div className="card flex items-center gap-3 px-5 py-4">
        <div className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 animate-bounce rounded-full bg-forest-500"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
        <span className="text-sm text-bark-600">Analyse des données…</span>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-pulse rounded-3xl bg-wheat-500/40 blur-2xl" />
        <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-linear-to-br from-wheat-300 to-wheat-600 text-forest-950 shadow-xl">
          <Sparkles size={28} />
        </div>
      </div>
      <h1 className="mt-6 font-display text-4xl text-forest-900">Votre assistant de ferme</h1>
      <p className="mt-2 max-w-md text-bark-600">
        Posez vos questions en langage naturel. L'assistant interroge directement les données de votre troupeau.
      </p>
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={s.title}
            onClick={() => onPick(s.prompt)}
            className="card card-hover animate-fade-up cursor-pointer p-4 text-left"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-wheat-600">{s.title}</p>
            <p className="mt-1 text-sm text-bark-900">{s.prompt}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Défilement automatique vers le dernier message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // Zone de saisie qui s'agrandit avec le texte
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    const history: Message[] = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const res = await api.chat(
        history.filter((m) => !m.error).map(({ role, content }) => ({ role, content }))
      );
      setMessages([...history, { role: "assistant", content: res.reply, tools: res.tools_used }]);
    } catch (err) {
      setMessages([...history, { role: "assistant", content: (err as Error).message, error: true }]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col">
      {messages.length > 0 && (
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AiAvatar />
            <div>
              <h1 className="font-display text-xl text-forest-900">Assistant IA</h1>
              <p className="text-xs text-bark-600">Connecté aux données de la ferme</p>
            </div>
          </div>
          <button
            onClick={() => setMessages([])}
            disabled={loading}
            className="btn-secondary px-3 py-2 text-xs"
          >
            <RotateCcw size={14} /> Nouvelle conversation
          </button>
        </header>
      )}

      {messages.length === 0 ? (
        <EmptyState onPick={send} />
      ) : (
        <div className="flex-1 space-y-6 pb-6">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex animate-fade-up justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-forest-800 px-4 py-3 text-sm text-cream-50 shadow-md">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex animate-fade-up gap-3">
                <AiAvatar />
                <div className="min-w-0 flex-1">
                  <div
                    className={`card rounded-tl-md px-5 py-4 text-sm leading-relaxed ${
                      m.error ? "border-clay-500/30 text-clay-500" : ""
                    }`}
                  >
                    {m.error ? (
                      m.content
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                        {m.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  {m.tools && m.tools.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-bark-600">
                      <Database size={12} /> Données consultées :
                      {m.tools.map((t) => (
                        <span key={t} className="rounded-full bg-cream-200 px-2 py-0.5 font-semibold">
                          {TOOL_LABELS[t] ?? t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          )}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Zone de saisie */}
      <div className="sticky bottom-0 -mx-4 bg-linear-to-t from-cream-100 via-cream-100 to-transparent px-4 pb-4 pt-6 sm:mx-0 sm:px-0">
        <form
          onSubmit={handleSubmit}
          className="card flex items-end gap-2 p-2 transition focus-within:ring-4 focus-within:ring-forest-500/15"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question sur votre ferme…"
            className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-bark-600/60"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Envoyer"
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-forest-800 text-cream-50 transition hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp size={18} />
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-bark-600/70">
          L'assistant peut se tromper : vérifiez les décisions importantes. Entrée pour envoyer · Maj+Entrée pour un saut de ligne.
        </p>
      </div>
    </div>
  );
}