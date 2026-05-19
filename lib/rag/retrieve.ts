import { RetrievedChunk } from "./types";

export async function retrieveRelevantChunks(question: string): Promise<RetrievedChunk[]> {
  return [
    {
      id: "mock-0",
      source: "mock-document.pdf",
      chunkIndex: 0,
      content: `Trecho simulado recuperado para a pergunta: "${question}".`,
      score: 0.99,
      metadata: {
        mode: "mock",
      },
    },
  ];
}
