import { generateEmbedding } from "./embeddings";
import { searchSimilarChunksByEmbedding } from "./vector-store";
import { RetrievedChunk } from "./types";

const VECTOR_TOP_K = 3;
const MIN_VECTOR_SCORE = 0.7;

export async function retrieveRelevantChunks(question: string): Promise<RetrievedChunk[]> {
  try {
    const questionEmbedding = await generateEmbedding(question);

    const vectorChunks = await searchSimilarChunksByEmbedding(
      questionEmbedding,
      VECTOR_TOP_K,
      MIN_VECTOR_SCORE
    );

    return vectorChunks;
  } catch (error) {
    console.error("Falha na busca vetorial:", error);
    return [];
  }
}
