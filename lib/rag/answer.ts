import { retrieveRelevantChunks } from "./retrieve";
import { ChatAnswer } from "./types";

export async function generateMockRagAnswer(question: string): Promise<ChatAnswer> {
  const chunks = await retrieveRelevantChunks(question);

  const hasRealChunks = chunks.some((chunk) => chunk.source !== "mock-empty-store");

  if (!hasRealChunks) {
    return {
      answer:
        "Ainda não encontrei documentos ingeridos no store mockado. Faça uma ingestão primeiro no endpoint /api/ingest e depois tente perguntar novamente.",
      chunks,
    };
  }

  const context = chunks
    .map((chunk, index) => {
      return `Trecho ${index + 1} - Fonte: ${chunk.source}\n${chunk.content}`;
    })
    .join("\n\n");

  return {
    answer:
      `Resposta prévia com base nos chunks recuperados do Edge SQL.\n\n` +
      `Pergunta: ${question}\n\n` +
      `Contexto recuperado:\n${context}`,
    chunks,
  };
}
