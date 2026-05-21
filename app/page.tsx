"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

const exampleQuestions = [
  "Quais formatos a base de conhecimento suporta no upload?",
  "Qual a diferença entre cloudlets standard e cloudlets premium?",
  "Qual CNAME foi informado como origem correta da aplicação da Ri Happy?",
];

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState("");
  const [sources, setSources] = useState<RagSource[]>([]);
  const [chunks, setChunks] = useState<RagChunk[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const hasResult = answer || sources.length > 0 || chunks.length > 0 || error;

  const canSend = useMemo(() => {
    return question.trim().length > 0 && !loading;
  }, [question, loading]);

  async function handleSend(customQuestion?: string) {
    const currentQuestion = customQuestion || question;

    if (!currentQuestion.trim()) return;

    setQuestion(currentQuestion);
    setLoading(true);
    setAnswer("");
    setMode("");
    setSources([]);
    setChunks([]);
    setError("");
    setShowContext(false);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: currentQuestion }),
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

  function clearChat() {
    setQuestion("");
    setAnswer("");
    setMode("");
    setSources([]);
    setChunks([]);
    setError("");
    setShowContext(false);
  }

  function formatScore(score?: number) {
    if (typeof score !== "number" || Number.isNaN(score)) return "-";
    return `${(score * 100).toFixed(1)}%`;
  }

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-neutral-800 bg-neutral-950/80 p-5 shadow-2xl md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-black">
                RAG Edge
              </span>

              {mode ? (
                <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-xs text-orange-300">
                  {mode}
                </span>
              ) : null}
            </div>

            <h1 className="text-2xl font-bold tracking-tight md:text-4xl">
              Azion RAG Chat
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              Chat com busca vetorial no Edge SQL, embeddings via AI Inference e resposta contextualizada com modelo generativo.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/knowledge"
              className="rounded-2xl border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-100 transition hover:border-orange-500 hover:bg-orange-500/10"
            >
              Gerenciar base
            </a>

            <button
              type="button"
              onClick={clearChat}
              className="rounded-2xl border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-100 transition hover:bg-neutral-800"
            >
              Limpar
            </button>
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
          <aside className="flex flex-col gap-4 rounded-3xl border border-neutral-800 bg-neutral-950/80 p-5 shadow-2xl">
            <div>
              <h2 className="text-lg font-semibold">Pergunta</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Faça uma pergunta sobre os documentos indexados.
              </p>
            </div>

            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Digite sua pergunta..."
              className="min-h-[180px] w-full resize-none rounded-2xl border border-neutral-800 bg-black p-4 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-600 focus:border-orange-500"
            />

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!canSend}
              className="rounded-2xl bg-orange-500 px-5 py-4 text-sm font-bold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Consultando base..." : "Enviar pergunta"}
            </button>

            <div className="mt-2 rounded-2xl border border-neutral-800 bg-black/60 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Exemplos rápidos
              </p>

              <div className="flex flex-col gap-2">
                {exampleQuestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleSend(item)}
                    disabled={loading}
                    className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-3 text-left text-sm leading-5 text-neutral-300 transition hover:border-orange-500/60 hover:text-white disabled:opacity-50"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="flex flex-col gap-4">
            <div className="min-h-[360px] rounded-3xl border border-neutral-800 bg-neutral-950/80 p-6 shadow-2xl">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Resposta</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Resposta final gerada com base no contexto recuperado.
                  </p>
                </div>

                {loading ? (
                  <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs text-orange-300">
                    Processando
                  </span>
                ) : null}
              </div>

              {error ? (
                <div className="whitespace-pre-wrap rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm leading-6 text-red-200">
                  {error}
                </div>
              ) : (
                <div className="rounded-2xl border border-neutral-800 bg-black p-5">
                  {answer ? (
                    <div className="text-sm leading-7 text-neutral-100 md:text-base">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => (
                            <h1 className="mb-4 text-2xl font-bold text-white">{children}</h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="mb-3 mt-5 text-xl font-bold text-white">{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="mb-2 mt-4 text-lg font-semibold text-white">{children}</h3>
                          ),
                          p: ({ children }) => (
                            <p className="mb-4 text-neutral-100">{children}</p>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-bold text-white">{children}</strong>
                          ),
                          ul: ({ children }) => (
                            <ul className="mb-4 ml-5 list-disc space-y-2 text-neutral-100">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="mb-4 ml-5 list-decimal space-y-3 text-neutral-100">{children}</ol>
                          ),
                          li: ({ children }) => (
                            <li className="pl-1 text-neutral-100">{children}</li>
                          ),
                          code: ({ children }) => (
                            <code className="rounded-md bg-neutral-900 px-1.5 py-0.5 text-orange-300">
                              {children}
                            </code>
                          ),
                          table: ({ children }) => (
                            <div className="mb-4 overflow-x-auto rounded-xl border border-neutral-800">
                              <table className="w-full border-collapse text-left text-sm">
                                {children}
                              </table>
                            </div>
                          ),
                          th: ({ children }) => (
                            <th className="border-b border-neutral-800 bg-neutral-900 px-3 py-2 font-semibold text-white">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border-b border-neutral-900 px-3 py-2 text-neutral-200">
                              {children}
                            </td>
                          ),
                        }}
                      >
                        {answer}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-sm leading-7 text-neutral-500 md:text-base">
                      A resposta aparecerá aqui após a consulta.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Fontes</h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      Documentos usados na resposta.
                    </p>
                  </div>

                  {sources.length > 0 ? (
                    <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300">
                      {sources.length}
                    </span>
                  ) : null}
                </div>

                {sources.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-800 bg-black p-4 text-sm text-neutral-500">
                    Nenhuma fonte recuperada ainda.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {sources.map((source, index) => (
                      <div
                        key={`${source.source}-${source.chunkIndex}-${index}`}
                        className="rounded-2xl border border-neutral-800 bg-black p-4"
                      >
                        <p className="line-clamp-2 text-sm font-semibold text-neutral-100">
                          {source.source}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs text-neutral-400">
                            Chunk {source.chunkIndex}
                          </span>

                          <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-xs text-orange-300">
                            Score {formatScore(source.score)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-5 shadow-2xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Contexto recuperado</h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      Trechos consultados pelo RAG.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowContext((value) => !value)}
                    disabled={chunks.length === 0}
                    className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-200 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {showContext ? "Ocultar contexto" : "Ver contexto"}
                  </button>
                </div>

                {!hasResult ? (
                  <div className="rounded-2xl border border-neutral-800 bg-black p-4 text-sm text-neutral-500">
                    O contexto aparecerá após uma consulta.
                  </div>
                ) : chunks.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-800 bg-black p-4 text-sm text-neutral-500">
                    Nenhum trecho retornado.
                  </div>
                ) : !showContext ? (
                  <div className="rounded-2xl border border-neutral-800 bg-black p-4 text-sm leading-6 text-neutral-400">
                    {chunks.length} trecho(s) recuperado(s). Clique em{" "}
                    <span className="text-neutral-200">Ver contexto</span> para expandir.
                  </div>
                ) : (
                  <div className="max-h-[460px] space-y-3 overflow-auto pr-2">
                    {chunks.map((chunk, index) => (
                      <article
                        key={`${chunk.id}-${index}`}
                        className="rounded-2xl border border-neutral-800 bg-black p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="line-clamp-2 text-sm font-semibold text-neutral-100">
                              {chunk.source}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">
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
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
