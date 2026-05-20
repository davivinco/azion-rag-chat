"use client";

import { useMemo, useState } from "react";

type RagSource = {
  source: string;
  chunkIndex: number;
  score?: number;
};

type RagChunk = {
  id: string;
  source: string;
  chunkIndex: number;
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

type ChatResponse = {
  ok?: boolean;
  mode?: string;
  answer?: string;
  sources?: RagSource[];
  chunks?: RagChunk[];
  error?: string;
  details?: string;
};

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState("");
  const [sources, setSources] = useState<RagSource[]>([]);
  const [chunks, setChunks] = useState<RagChunk[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSend = useMemo(() => {
    return question.trim().length > 0 && !loading;
  }, [question, loading]);

  async function handleSend() {
    if (!question.trim()) return;

    setLoading(true);
    setAnswer("");
    setMode("");
    setSources([]);
    setChunks([]);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: question }),
      });

      const data = (await res.json()) as ChatResponse;

      if (!res.ok || data.ok === false) {
        setError(
          data?.details
            ? `${data?.error ?? "Erro"}\n\nDetalhes: ${data.details}`
            : data?.error ?? "Erro ao processar a solicitação."
        );
        return;
      }

      setAnswer(data.answer ?? "Sem resposta.");
      setMode(data.mode ?? "");
      setSources(data.sources ?? []);
      setChunks(data.chunks ?? []);
    } catch (error) {
      console.error("Erro ao chamar a API:", error);
      setError("Erro ao chamar a API.");
    } finally {
      setLoading(false);
    }
  }

  function formatScore(score?: number) {
    if (typeof score !== "number" || Number.isNaN(score)) return "-";
    return `${(score * 100).toFixed(1)}%`;
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
          <div className="mb-6 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">Azion RAG Chat v5.0</h1>

              {mode ? (
                <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-300">
                  {mode}
                </span>
              ) : null}
            </div>

            <p className="text-sm text-neutral-400">
              Assistente RAG com embeddings, busca vetorial no Edge SQL e resposta via AI Inference.
            </p>

            <a
              href="/knowledge"
              className="mt-3 inline-flex w-fit rounded-xl border border-neutral-700 px-4 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800"
            >
              Gerenciar base de conhecimento
            </a>
          </div>

          <div className="flex flex-col gap-4">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Digite sua pergunta..."
              className="min-h-[140px] w-full resize-none rounded-xl border border-neutral-700 bg-neutral-950 p-4 text-white outline-none transition focus:border-orange-500"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Consultando..." : "Enviar pergunta"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuestion("");
                  setAnswer("");
                  setMode("");
                  setSources([]);
                  setChunks([]);
                  setError("");
                }}
                disabled={loading}
                className="rounded-xl border border-neutral-700 px-5 py-3 font-medium text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-50"
              >
                Limpar
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Resposta</h2>
              {loading ? (
                <span className="text-sm text-neutral-400">Processando...</span>
              ) : null}
            </div>

            {error ? (
              <div className="whitespace-pre-wrap rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </div>
            ) : (
              <div className="min-h-[180px] whitespace-pre-wrap rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-neutral-100">
                {answer || "A resposta aparecerá aqui."}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold">Fontes utilizadas</h2>

            {sources.length === 0 ? (
              <p className="text-sm text-neutral-400">
                As fontes recuperadas aparecerão aqui após uma consulta.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {sources.map((source, index) => (
                  <div
                    key={`${source.source}-${source.chunkIndex}-${index}`}
                    className="rounded-xl border border-neutral-800 bg-neutral-950 p-4"
                  >
                    <p className="text-sm font-medium text-neutral-100">
                      {source.source}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-400">
                      <span className="rounded-full bg-neutral-800 px-2 py-1">
                        Chunk {source.chunkIndex}
                      </span>
                      <span className="rounded-full bg-neutral-800 px-2 py-1">
                        Score {formatScore(source.score)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Contexto recuperado</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Trechos usados pelo RAG para gerar a resposta.
              </p>
            </div>

            {chunks.length > 0 ? (
              <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">
                {chunks.length} trecho(s)
              </span>
            ) : null}
          </div>

          {chunks.length === 0 ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
              Nenhum contexto recuperado ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {chunks.map((chunk, index) => (
                <article
                  key={`${chunk.id}-${index}`}
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-neutral-100">
                        {chunk.source}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Chunk {chunk.chunkIndex} · Score {formatScore(chunk.score)}
                      </p>
                    </div>

                    <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs text-orange-300">
                      #{index + 1}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-300">
                    {chunk.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
