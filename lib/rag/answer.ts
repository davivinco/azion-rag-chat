import { generateAnswerWithContext } from "./llm";
import { retrieveRelevantChunks } from "./retrieve";
import { ChatAnswer, RagSource, RetrievedChunk } from "./types";

function buildSources(chunks: RetrievedChunk[]): RagSource[] {
  const seen = new Set<string>();

  return chunks
    .map((chunk) => ({
      source: chunk.source,
      chunkIndex: chunk.chunkIndex,
      score: chunk.score,
    }))
    .filter((source) => {
      const key = `${source.source}-${source.chunkIndex}`;

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
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

  const context = chunks
    .map((chunk, index) => {
      return `Trecho ${index + 1} - Fonte: ${chunk.source} - Chunk: ${chunk.chunkIndex}\n${chunk.content}`;
    })
    .join("\n\n");

  const sources = buildSources(chunks);

  try {
    const answer = await generateAnswerWithContext({
      question,
      context,
    });

    return {
      answer,
      chunks,
      sources,
    };
  } catch (error) {
    console.error("Falha ao gerar resposta com LLM. Usando resposta fallback:", error);

    return {
      answer:
        `Resposta prévia com base nos chunks recuperados do Edge SQL.\n\n` +
        `Pergunta: ${question}\n\n` +
        `Contexto recuperado:\n${context}`,
      chunks,
      sources,
    };
  }
}
