"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: string;
  sources?: RagSource[];
  chunks?: RagChunk[];
  error?: boolean;
};

const exampleQuestions = [
  "Quais formatos a base de conhecimento suporta no upload?",
  "Qual a diferença entre cloudlets standard e cloudlets premium?",
  "Qual CNAME foi informado como origem correta da aplicação da Ri Happy?",
];

function formatScore(score?: number) {
  if (typeof score !== "number" || Number.isNaN(score)) return "-";
  return `${(score * 100).toFixed(1)}%`;
}

function MarkdownContent({ content }: { content: string }) {
  return (
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
          <p className="mb-4 leading-7 text-neutral-100 last:mb-0">{children}</p>
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
        li: ({ children }) => <li className="pl-1 text-neutral-100">{children}</li>,
        code: ({ children }) => (
          <code className="rounded-md bg-neutral-900 px-1.5 py-0.5 text-orange-300">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="mb-4 overflow-x-auto rounded-xl border border-neutral-800 bg-black p-4 text-sm text-neutral-100">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full border-collapse text-left text-sm">{children}</table>
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
      {content}
    </ReactMarkdown>
  );
}

function AssistantMetadata({
  sources = [],
  chunks = [],
}: {
  sources?: RagSource[];
  chunks?: RagChunk[];
}) {
  const [openSources, setOpenSources] = useState(false);
  const [openContext, setOpenContext] = useState(false);

  if (!sources.length && !chunks.length) return null;

  return (
    <div className="mt-5 space-y-3">
      {sources.length > 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950">
          <button
            type="button"
            onClick={() => setOpenSources((value) => !value)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-neutral-200"
          >
            <span>Fontes utilizadas ({sources.length})</span>
            <span className="text-neutral-500">{openSources ? "Ocultar" : "Ver"}</span>
          </button>

          {openSources ? (
            <div className="space-y-2 border-t border-neutral-800 p-3">
              {sources.map((source, index) => (
                <div
                  key={`${source.source}-${source.chunkIndex}-${index}`}
                  className="rounded-xl border border-neutral-800 bg-black p-3"
                >
                  <p className="line-clamp-2 text-sm font-medium text-neutral-100">
                    {source.source}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
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
          ) : null}
        </div>
      ) : null}

      {chunks.length > 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950">
          <button
            type="button"
            onClick={() => setOpenContext((value) => !value)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-neutral-200"
          >
            <span>Contexto recuperado ({chunks.length})</span>
            <span className="text-neutral-500">{openContext ? "Ocultar" : "Ver"}</span>
          </button>

          {openContext ? (
            <div className="max-h-[420px] space-y-3 overflow-auto border-t border-neutral-800 p-3">
              {chunks.map((chunk, index) => (
                <article
                  key={`${chunk.id}-${index}`}
                  className="rounded-xl border border-neutral-800 bg-black p-3"
                >
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="line-clamp-2 text-sm font-semibold text-neutral-100">
                        {chunk.source}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Chunk {chunk.chunkIndex} · Score {formatScore(chunk.score)}
                      </p>
                    </div>

                    <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-xs text-orange-300">
                      #{index + 1}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-300">
                    {chunk.content}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Olá! Sou o assistente RAG da aplicação. Faça uma pergunta sobre os documentos indexados na base de conhecimento.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = useMemo(() => {
    return question.trim().length > 0 && !loading;
  }, [question, loading]);

  async function sendQuestion(customQuestion?: string) {
    const currentQuestion = customQuestion || question;

    if (!currentQuestion.trim()) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: currentQuestion,
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setLoading(true);

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
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          error: true,
          content: data?.details
            ? `${data?.error ?? "Erro"}\n\nDetalhes: ${data.details}`
            : data?.error ?? "Erro ao processar a solicitação.",
        };

        setMessages((current) => [...current, errorMessage]);
        return;
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer ?? "Sem resposta.",
        mode: data.mode,
        sources: data.sources ?? [],
        chunks: data.chunks ?? [],
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      console.error("Erro ao chamar a API:", error);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          error: true,
          content: "Erro ao chamar a API.",
        },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendQuestion();
  }

  function clearChat() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Conversa limpa. Faça uma nova pergunta sobre a base de conhecimento.",
      },
    ]);
    setQuestion("");
  }

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-neutral-800 bg-neutral-950 p-4 lg:flex lg:flex-col">
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-orange-500" />
              <div>
                <h1 className="text-sm font-bold">Azion RAG</h1>
                <p className="text-xs text-neutral-500">Edge SQL + AI Inference</p>
              </div>
            </div>

            <button
              type="button"
              onClick={clearChat}
              className="w-full rounded-xl border border-neutral-800 px-3 py-2 text-left text-sm text-neutral-200 transition hover:bg-neutral-900"
            >
              Nova conversa
            </button>
          </div>

          <div className="mb-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Exemplos
            </p>

            <div className="space-y-2">
              {exampleQuestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => sendQuestion(item)}
                  disabled={loading}
                  className="w-full rounded-xl border border-neutral-800 bg-black px-3 py-3 text-left text-xs leading-5 text-neutral-300 transition hover:border-orange-500/60 hover:text-white disabled:opacity-50"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto space-y-2">
            <a
              href="/knowledge"
              className="block rounded-xl border border-neutral-800 px-3 py-3 text-sm text-neutral-200 transition hover:border-orange-500/60 hover:bg-orange-500/10"
            >
              Gerenciar base
            </a>

            <p className="text-xs leading-5 text-neutral-600">
              Application na Edge, embeddings com Qwen3, busca vetorial no Edge SQL e resposta com Mistral.
            </p>
          </div>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950/80 px-4 py-3 backdrop-blur lg:hidden">
            <div>
              <h1 className="text-sm font-bold">Azion RAG Chat</h1>
              <p className="text-xs text-neutral-500">Edge SQL + AI Inference</p>
            </div>

            <a
              href="/knowledge"
              className="rounded-xl border border-neutral-800 px-3 py-2 text-xs text-neutral-200"
            >
              Base
            </a>
          </header>

          <div className="flex-1 overflow-y-auto px-4 pb-36 pt-6">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
              {messages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser ? (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-xs font-bold text-black">
                        AI
                      </div>
                    ) : null}

                    <div
                      className={
                        isUser
                          ? "max-w-[85%] rounded-3xl bg-neutral-800 px-5 py-4 text-sm leading-7 text-neutral-100"
                          : message.error
                            ? "max-w-[92%] rounded-3xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm leading-7 text-red-100"
                            : "max-w-[92%] rounded-3xl border border-neutral-800 bg-neutral-950 px-5 py-4 text-sm leading-7 text-neutral-100"
                      }
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <>
                          {message.mode ? (
                            <div className="mb-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs leading-none text-orange-300">
                                {message.mode}
                              </span>
                            </div>
                          ) : null}

                          <MarkdownContent content={message.content} />

                          <AssistantMetadata
                            sources={message.sources}
                            chunks={message.chunks}
                          />
                        </>
                      )}
                    </div>

                    {isUser ? (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-xs font-bold text-neutral-300">
                        Você
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {loading ? (
                <div className="flex gap-4">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-xs font-bold text-black">
                    AI
                  </div>

                  <div className="rounded-3xl border border-neutral-800 bg-neutral-950 px-5 py-4 text-sm text-neutral-400">
                    Consultando a base de conhecimento...
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 border-t border-neutral-800 bg-[#090909]/95 px-4 py-4 backdrop-blur lg:left-[280px]">
            <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-3xl gap-3">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendQuestion();
                  }
                }}
                placeholder="Pergunte algo sobre a base de conhecimento..."
                className="max-h-40 min-h-[56px] flex-1 resize-none rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-600 focus:border-orange-500"
              />

              <button
                type="submit"
                disabled={!canSend}
                className="h-[56px] rounded-2xl bg-orange-500 px-5 text-sm font-bold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enviar
              </button>
            </form>

            <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-neutral-600">
              O assistente responde com base nos documentos recuperados via RAG.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
