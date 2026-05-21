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
  streaming?: boolean;
};

const exampleQuestions = [
  "Como essa aplicação usa AI Inference e Edge SQL para implementar RAG?",
  "Explique o fluxo de ingestão, embeddings e busca vetorial nesta solução.",
  "Quais componentes da Azion permitem que essa aplicação rode na Edge?",
  "Como a ferramenta decide quando responder com RAG e quando responder como LLM geral?",
  "Quais formatos são suportados no upload da base de conhecimento?",
  "Como o Edge SQL é usado para armazenar documentos, chunks e embeddings?",
];

function formatScore(score?: number) {
  if (typeof score !== "number" || Number.isNaN(score)) return "-";
  return `${(score * 100).toFixed(1)}%`;
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none prose-p:leading-7 prose-p:text-neutral-100 prose-li:text-neutral-100 prose-strong:text-white prose-strong:font-bold prose-code:text-orange-300 prose-code:bg-neutral-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-pre:bg-black prose-pre:border prose-pre:border-neutral-800 prose-pre:rounded-xl prose-table:text-sm prose-th:border-neutral-800 prose-td:border-neutral-800">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function StreamingContent({ content }: { content: string }) {
  return (
    <div className="whitespace-pre-wrap text-sm leading-7 text-neutral-100">
      {content}
      <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-orange-400 align-middle" />
    </div>
  );
}

function AssistantDetails({
  sources = [],
  chunks = [],
}: {
  sources?: RagSource[];
  chunks?: RagChunk[];
}) {
  const [showSources, setShowSources] = useState(false);
  const [showContext, setShowContext] = useState(false);

  if (!sources.length && !chunks.length) return null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      {sources.length > 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80">
          <button
            type="button"
            onClick={() => setShowSources((value) => !value)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-neutral-300 transition hover:text-white"
          >
            <span>Fontes utilizadas ({sources.length})</span>
            <span className="text-xs text-neutral-500">
              {showSources ? "Ocultar" : "Mostrar"}
            </span>
          </button>

          {showSources ? (
            <div className="grid gap-2 border-t border-neutral-800 p-3 md:grid-cols-2">
              {sources.map((source, index) => (
                <div
                  key={`${source.source}-${source.chunkIndex}-${index}`}
                  className="rounded-xl border border-neutral-800 bg-black/60 p-3"
                >
                  <p className="line-clamp-2 text-sm font-medium text-neutral-100">
                    {source.source}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-neutral-400">
                      Chunk {source.chunkIndex}
                    </span>
                    <span className="rounded-full bg-orange-500/10 px-2 py-1 text-xs text-orange-300">
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
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80">
          <button
            type="button"
            onClick={() => setShowContext((value) => !value)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-neutral-300 transition hover:text-white"
          >
            <span>Contexto recuperado ({chunks.length})</span>
            <span className="text-xs text-neutral-500">
              {showContext ? "Ocultar" : "Mostrar"}
            </span>
          </button>

          {showContext ? (
            <div className="max-h-[420px] space-y-3 overflow-auto border-t border-neutral-800 p-3">
              {chunks.map((chunk, index) => (
                <article
                  key={`${chunk.id}-${index}`}
                  className="rounded-xl border border-neutral-800 bg-black/60 p-3"
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

    const assistantId = crypto.randomUUID();

    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      sources: [],
      chunks: [],
      streaming: true,
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setQuestion("");
    setLoading(true);

    let deltaQueue = "";
    let pumpTimer: ReturnType<typeof setInterval> | null = null;

    function appendToAssistant(text: string) {
      if (!text) return;

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: `${message.content}${text}`,
              }
            : message
        )
      );
    }

    function startPump() {
      if (pumpTimer) return;

      pumpTimer = setInterval(() => {
        if (!deltaQueue) return;

        const chunkSize = Math.min(18, Math.max(4, Math.ceil(deltaQueue.length / 12)));
        const nextChunk = deltaQueue.slice(0, chunkSize);

        deltaQueue = deltaQueue.slice(chunkSize);
        appendToAssistant(nextChunk);
      }, 28);
    }

    function stopPump() {
      if (pumpTimer) {
        clearInterval(pumpTimer);
        pumpTimer = null;
      }

      if (deltaQueue) {
        appendToAssistant(deltaQueue);
        deltaQueue = "";
      }
    }

    function finishAssistantStreaming() {
      stopPump();

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                streaming: false,
              }
            : message
        )
      );
    }

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: currentQuestion }),
      });

      if (!response.body) {
        finishAssistantStreaming();

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  error: true,
                  content: "Resposta sem corpo de streaming.",
                }
              : message
          )
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      function applyEvent(eventName: string, dataText: string) {
        if (!dataText.trim()) return;

        const data = JSON.parse(dataText);

        if (eventName === "meta") {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    mode: data.mode,
                    sources: data.sources || [],
                    chunks: data.chunks || [],
                  }
                : message
            )
          );
          return;
        }

        if (eventName === "delta") {
          const delta = data.content || "";
          deltaQueue += delta;
          startPump();
          return;
        }

        if (eventName === "done") {
          finishAssistantStreaming();
          return;
        }

        if (eventName === "error") {
          finishAssistantStreaming();

          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    error: true,
                    content: data.details
                      ? `${data.error || "Erro"}\n\nDetalhes: ${data.details}`
                      : data.error || "Erro ao processar streaming.",
                  }
                : message
            )
          );
        }
      }

      function processRawEvent(rawEvent: string) {
        const lines = rawEvent.split("\n");
        let eventName = "message";
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.replace(/^event:\s*/, "").trim();
          }

          if (line.startsWith("data:")) {
            dataLines.push(line.replace(/^data:\s*/, ""));
          }
        }

        if (dataLines.length > 0) {
          applyEvent(eventName, dataLines.join("\n"));
        }
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const rawEvent of events) {
          processRawEvent(rawEvent);
        }
      }

      if (buffer.trim()) {
        processRawEvent(buffer);
      }

      finishAssistantStreaming();
    } catch (error) {
      console.error("Erro ao chamar a API:", error);
      finishAssistantStreaming();

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                error: true,
                content: "Erro ao chamar a API.",
              }
            : message
        )
      );
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
    setMessages([]);
    setQuestion("");
    textareaRef.current?.focus();
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-neutral-900 bg-[#0a0a0a]/90 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-500 text-sm font-black text-black">
                A
              </div>

              <div>
                <h1 className="text-sm font-semibold leading-none text-white">
                  Azion RAG Chat
                </h1>
                <p className="mt-1 text-xs text-neutral-500">
                  Edge SQL + AI Inference
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearChat}
                className="rounded-xl border border-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 transition hover:bg-neutral-900 hover:text-white"
              >
                Nova conversa
              </button>

              <a
                href="/knowledge"
                className="rounded-xl bg-neutral-100 px-3 py-2 text-xs font-semibold text-black transition hover:bg-orange-500"
              >
                Base de conhecimento
              </a>
            </div>
          </div>
        </header>

        <section className="flex-1 px-4 pb-36 pt-8">
          <div className="mx-auto w-full max-w-3xl">
            {messages.length === 0 ? (
              <div className="flex min-h-[calc(100vh-220px)] flex-col items-center justify-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-500 text-2xl font-black text-black shadow-2xl shadow-orange-500/20">
                  A
                </div>

                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                  Como posso ajudar?
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
                  Faça perguntas sobre a base de conhecimento ou use o assistente em modo geral quando não houver contexto relevante.
                </p>

                <div className="mt-8 grid w-full grid-cols-1 gap-3 md:grid-cols-2">
                  {exampleQuestions.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => sendQuestion(example)}
                      disabled={loading}
                      className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-left text-sm leading-6 text-neutral-300 transition hover:border-orange-500/70 hover:bg-neutral-900 hover:text-white disabled:opacity-50"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {messages.map((message) => {
                  const isUser = message.role === "user";

                  return (
                    <div key={message.id} className="group">
                      <div
                        className={`flex gap-4 ${
                          isUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!isUser ? (
                          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-sm font-black text-black">
                            A
                          </div>
                        ) : null}

                        <div
                          className={
                            isUser
                              ? "max-w-[85%] rounded-3xl bg-neutral-800 px-5 py-4 text-sm leading-7 text-neutral-100"
                              : message.error
                                ? "w-full rounded-3xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm leading-7 text-red-100"
                                : "w-full rounded-3xl border border-neutral-900 bg-neutral-950/70 px-5 py-5 text-sm leading-7 text-neutral-100"
                          }
                        >
                          {isUser ? (
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          ) : (
                            <>
                              {message.mode ? (
                                <div className="mb-4 flex flex-wrap items-center gap-2">
                                  <span
                                    className={
                                      message.mode === "llm-general"
                                        ? "rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs leading-none text-blue-300"
                                        : "rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs leading-none text-orange-300"
                                    }
                                  >
                                    {message.mode === "llm-general"
                                      ? "Resposta geral"
                                      : "Resposta com RAG"}
                                  </span>

                                  {message.mode === "llm-general" ? (
                                    <span className="text-xs text-neutral-500">
                                      Sem fontes da base de conhecimento
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}

                              {message.streaming ? (
                                <StreamingContent content={message.content} />
                              ) : (
                                <MarkdownContent content={message.content} />
                              )}

                              {!message.streaming ? (
                                <AssistantDetails
                                  sources={message.sources}
                                  chunks={message.chunks}
                                />
                              ) : null}
                            </>
                          )}
                        </div>

                        {isUser ? (
                          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-neutral-800 text-[10px] font-bold text-neutral-300">
                            Você
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {loading ? (
                  <div className="flex gap-4">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-sm font-black text-black">
                      A
                    </div>

                    <div className="rounded-3xl border border-neutral-900 bg-neutral-950/70 px-5 py-4 text-sm text-neutral-400">
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
                        Consultando a base e gerando resposta...
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-neutral-900 bg-[#0a0a0a]/95 px-4 py-4 backdrop-blur">
          <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl">
            <div className="flex items-end gap-3 rounded-3xl border border-neutral-800 bg-neutral-950 p-2 shadow-2xl">
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
                placeholder="Pergunte algo..."
                rows={1}
                className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-neutral-600"
              />

              <button
                type="submit"
                disabled={!canSend}
                className="mb-1 h-10 rounded-2xl bg-orange-500 px-4 text-sm font-bold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Enviar
              </button>
            </div>

            <p className="mt-2 text-center text-xs text-neutral-600">
              Enter envia · Shift + Enter quebra linha
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
