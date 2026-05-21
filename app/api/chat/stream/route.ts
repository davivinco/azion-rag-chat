import { NextRequest } from "next/server";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";
import { RagSource, RetrievedChunk } from "@/lib/rag/types";

export const runtime = "edge";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ChatRequestBody = {
  messages?: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  prompt?: string;
  message?: string;
};

const MAX_CONTEXT_CHARS_PER_CHUNK = 1200;
const MAX_DISPLAY_CHARS_PER_CHUNK = 700;

function getEnv(name: string): string {
  const azionGlobal = globalThis as typeof globalThis & {
    Azion?: {
      env?: {
        get?: (key: string) => string | undefined;
      };
    };
  };

  const azionValue = azionGlobal.Azion?.env?.get?.(name);
  const nodeValue = process.env[name];

  const value = azionValue || nodeValue;

  if (!value) {
    throw new Error(`Variável de ambiente não configurada: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string, fallback: string): string {
  const azionGlobal = globalThis as typeof globalThis & {
    Azion?: {
      env?: {
        get?: (key: string) => string | undefined;
      };
    };
  };

  return azionGlobal.Azion?.env?.get?.(name) || process.env[name] || fallback;
}

function getLastUserMessage(body: ChatRequestBody): string {
  if (body.prompt?.trim()) return body.prompt.trim();
  if (body.message?.trim()) return body.message.trim();

  const lastUserMessage = [...(body.messages || [])]
    .reverse()
    .find((msg) => msg.role === "user");

  return lastUserMessage?.content?.trim() || "";
}

function truncateText(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxChars) return normalized;

  return `${normalized.slice(0, maxChars).trim()}...`;
}

function buildSources(chunks: RetrievedChunk[]): RagSource[] {
  const bestSourceByDocument = new Map<string, RagSource>();

  for (const chunk of chunks) {
    const current = bestSourceByDocument.get(chunk.source);

    const nextSource: RagSource = {
      source: chunk.source,
      chunkIndex: chunk.chunkIndex,
      score: chunk.score,
    };

    if (!current) {
      bestSourceByDocument.set(chunk.source, nextSource);
      continue;
    }

    const currentScore = current.score ?? 0;
    const nextScore = nextSource.score ?? 0;

    if (nextScore > currentScore) {
      bestSourceByDocument.set(chunk.source, nextSource);
    }
  }

  return Array.from(bestSourceByDocument.values()).sort(
    (a, b) => Number(b.score ?? 0) - Number(a.score ?? 0)
  );
}

function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, index) => {
      const content = truncateText(chunk.content, MAX_CONTEXT_CHARS_PER_CHUNK);

      return [
        `Trecho ${index + 1}`,
        `Fonte: ${chunk.source}`,
        `Chunk: ${chunk.chunkIndex}`,
        `Score: ${typeof chunk.score === "number" ? chunk.score.toFixed(4) : "n/a"}`,
        "",
        content,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function buildDisplayChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  return chunks.map((chunk) => ({
    ...chunk,
    content: truncateText(chunk.content, MAX_DISPLAY_CHARS_PER_CHUNK),
  }));
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function buildMessages(question: string, context: string | null): ChatMessage[] {
  if (context) {
    return [
      {
        role: "system",
        content:
          "Você é um especialista técnico em cloud, edge computing, RAG, bancos vetoriais e documentação técnica. " +
          "Sua função é responder com alta precisão usando SOMENTE o contexto recuperado da base de conhecimento. " +
          "Não seja genérico. Extraia diferenças, valores, nomes, limites, componentes, fluxos e detalhes concretos do contexto. " +
          "Quando a pergunta pedir comparação, responda preferencialmente com tabela em Markdown e depois um resumo objetivo. " +
          "Quando houver números, preços, regiões, limites ou nomes técnicos no contexto, preserve esses dados. " +
          "Se o contexto não trouxer informação suficiente, diga claramente o que não foi encontrado. " +
          "Não invente fontes, números ou capacidades que não estejam no contexto. " +
          "Responda em português do Brasil, com linguagem profissional, direta e útil para apresentação a cliente.",
      },
      {
        role: "user",
        content:
          `Pergunta:\n${question}\n\n` +
          `Contexto recuperado:\n${context}\n\n` +
          "Instruções de resposta:\n" +
          "- Responda diretamente a pergunta.\n" +
          "- Use Markdown bem formatado.\n" +
          "- Use tabela quando houver comparação.\n" +
          "- Destaque pontos importantes em negrito.\n" +
          "- Não inclua introduções longas.\n" +
          "- Não diga que é uma IA.\n" +
          "- Não mencione chunks, embeddings ou retrieval, exceto se a pergunta for sobre o funcionamento do RAG.",
      },
    ];
  }

  return [
    {
      role: "system",
      content:
        "Você é um assistente útil, objetivo e confiável. Responda com conhecimento geral do modelo, sem afirmar que consultou a base de conhecimento. Quando a pergunta depender de dados atuais ou específicos que possam mudar, deixe claro que pode ser necessário validar em uma fonte atualizada.",
    },
    {
      role: "user",
      content:
        `Pergunta:\n${question}\n\n` +
        "Responda de forma objetiva, prática e bem estruturada.",
    },
  ];
}

async function callStreamingModel(messages: ChatMessage[]) {
  const endpoint = getEnv("CHAT_API_URL");
  const apiKey = getEnv("CHAT_API_KEY");
  const apiKeyHeader = getOptionalEnv("CHAT_API_KEY_HEADER", "X-API-Key");
  const model = getOptionalEnv(
    "CHAT_MODEL",
    "casperhansen-mistral-small-24b-instruct-2501-awq"
  );

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKeyHeader.toLowerCase() === "authorization") {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    headers[apiKeyHeader] = apiKey;
  }

  return fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 1800,
      temperature: 0.15,
      top_p: 0.9,
      messages,
    }),
  });
}

function extractDeltaFromPayload(payload: unknown): string {
  const data = payload as {
    choices?: Array<{
      delta?: {
        content?: string;
      };
      message?: {
        content?: string;
      };
      text?: string;
    }>;
  };

  return (
    data.choices?.[0]?.delta?.content ||
    data.choices?.[0]?.message?.content ||
    data.choices?.[0]?.text ||
    ""
  );
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body = (await req.json()) as ChatRequestBody;
    const question = getLastUserMessage(body);

    if (!question) {
      return new Response(
        encoder.encode(
          sse("error", {
            error: "Nenhuma pergunta foi enviada.",
          })
        ),
        {
          status: 400,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        }
      );
    }

    const chunks = await retrieveRelevantChunks(question);
    const hasContext = chunks.length > 0;

    const mode = hasContext ? "edge-sql-vector-rag" : "llm-general";
    const sources = hasContext ? buildSources(chunks) : [];
    const displayChunks = hasContext ? buildDisplayChunks(chunks) : [];
    const context = hasContext ? buildContext(chunks) : null;
    const messages = buildMessages(question, context);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              sse("meta", {
                mode,
                sources,
                chunks: displayChunks,
              })
            )
          );

          if (!hasContext) {
            controller.enqueue(
              encoder.encode(
                sse("delta", {
                  content:
                    "Não encontrei contexto relevante na base de conhecimento para essa pergunta.\n\n**Resposta geral:**\n\n",
                })
              )
            );
          }

          const response = await callStreamingModel(messages);

          if (!response.ok || !response.body) {
            const errorText = await response.text();

            controller.enqueue(
              encoder.encode(
                sse("error", {
                  error: "Erro ao gerar resposta no modelo.",
                  details: errorText,
                  status: response.status,
                })
              )
            );
            controller.close();
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const events = buffer.split("\n\n");
            buffer = events.pop() || "";

            for (const rawEvent of events) {
              const dataLines = rawEvent
                .split("\n")
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.replace(/^data:\s*/, ""));

              for (const dataLine of dataLines) {
                if (!dataLine || dataLine === "[DONE]") continue;

                try {
                  const payload = JSON.parse(dataLine);
                  const delta = extractDeltaFromPayload(payload);

                  if (delta) {
                    controller.enqueue(
                      encoder.encode(
                        sse("delta", {
                          content: delta,
                        })
                      )
                    );
                  }
                } catch {
                  // Ignora linhas que não são JSON válido.
                }
              }
            }
          }

          controller.enqueue(encoder.encode(sse("done", { ok: true })));
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              sse("error", {
                error: "Erro ao processar streaming.",
                details: error instanceof Error ? error.message : "Erro desconhecido",
              })
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return new Response(
      encoder.encode(
        sse("error", {
          error: "Erro ao iniciar streaming.",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        })
      ),
      {
        status: 500,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      }
    );
  }
}
