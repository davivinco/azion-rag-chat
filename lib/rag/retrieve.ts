import { generateEmbedding } from "./embeddings";
import { searchChunks } from "./store";
import { searchSimilarChunksByEmbedding } from "./vector-store";
import { RetrievedChunk } from "./types";

export async function retrieveRelevantChunks(question: string): Promise<RetrievedChunk[]> {
  try {
    const questionEmbedding = await generateEmbedding(question);
    const vectorChunks = await searchSimilarChunksByEmbedding(questionEmbedding, 5, 0.6);

    if (vectorChunks.length > 0) {
      return vectorChunks;
    }
  } catch (error) {
    console.error("Falha na busca vetorial. Usando fallback textual:", error);
  }

  const textChunks = await searchChunks(question);

  if (textChunks.length > 0) {
    return textChunks;
  }

  return [
    {
      id: "mock-empty-0",
      source: "mock-empty-store",
      chunkIndex: 0,
      content:
        "Nenhum documento real foi encontrado no Edge SQL. Faça uma ingestão primeiro usando /api/ingest.",
      score: 0,
      metadata: {
        mode: "empty-edge-sql",
      },
    },
  ];
}
