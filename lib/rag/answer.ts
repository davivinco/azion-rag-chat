import { generateAnswerWithContext } from "./llm";
import { retrieveRelevantChunks } from "./retrieve";
import { ChatAnswer, RagSource, RetrievedChunk } from "./types";

const MAX_CONTEXT_CHARS_PER_CHUNK = 900;
const MAX_DISPLAY_CHARS_PER_CHUNK = 650;

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

export async function generateMockRagAnswer(question: string): Promise<ChatAnswer> {
  const chunks = await retrieveRelevantChunks(question);

  const hasRealChunks = chunks.some((chunk) => chunk.source !== "mock-empty-store");

  if (!hasRealChunks) {
    return {
      answer:
        "Ainda não encontrei documentos ingeridos no Edge SQL. Faça uma ingestão primeiro no endpoint /api/ingest e depois tente perguntar novamente.",
      chunks,
      sources: [],
    };
  }

  const context = buildContext(chunks);
  const sources = buildSources(chunks);
  const displayChunks = buildDisplayChunks(chunks);

  try {
    const answer = await generateAnswerWithContext({
      question,
      context,
    });

    return {
      answer,
      chunks: displayChunks,
      sources,
    };
  } catch (error) {
    console.error("Falha ao gerar resposta com LLM. Usando resposta fallback:", error);

    return {
      answer:
        `Resposta prévia com base nos chunks recuperados do Edge SQL.\n\n` +
        `Pergunta: ${question}\n\n` +
        `Contexto recuperado:\n${context}`,
      chunks: displayChunks,
      sources,
    };
  }
}
