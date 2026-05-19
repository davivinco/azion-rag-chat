import { retrieveRelevantChunks } from "./retrieve";
import { ChatAnswer } from "./types";

export async function generateMockRagAnswer(question: string): Promise<ChatAnswer> {
  const chunks = await retrieveRelevantChunks(question);

  return {
    answer:
      "A aplicação base do RAG está funcionando. No momento, esta é uma resposta simulada, sem consulta real ao modelo, embeddings ou Edge SQL.",
    chunks,
  };
}
