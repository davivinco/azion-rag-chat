import { generateAnswerWithContext } from "./llm";
import { retrieveRelevantChunks } from "./retrieve";
import { ChatAnswer } from "./types";

export async function generateMockRagAnswer(question: string): Promise<ChatAnswer> {
  const chunks = await retrieveRelevantChunks(question);

  const hasRealChunks = chunks.some((chunk) => chunk.source !== "mock-empty-store");

  if (!hasRealChunks) {
    return {
      answer:
        "Ainda não encontrei documentos ingeridos no Edge SQL. Faça uma ingestão primeiro no endpoint /api/ingest e depois tente perguntar novamente.",
      chunks,
    };
  }

  const context = chunks
    .map((chunk, index) => {
      return `Trecho ${index + 1} - Fonte: ${chunk.source}\n${chunk.content}`;
    })
    .join("\n\n");

  try {
    const answer = await generateAnswerWithContext({
      question,
      context,
    });

    return {
      answer,
      chunks,
    };
  } catch (error) {
    console.error("Falha ao gerar resposta com LLM. Usando resposta fallback:", error);

    return {
      answer:
        `Resposta prévia com base nos chunks recuperados do Edge SQL.\n\n` +
        `Pergunta: ${question}\n\n` +
        `Contexto recuperado:\n${context}`,
      chunks,
    };
  }
}
