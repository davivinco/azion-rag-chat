import { searchChunks } from "./store";
import { RetrievedChunk } from "./types";

export async function retrieveRelevantChunks(question: string): Promise<RetrievedChunk[]> {
  const chunks = await searchChunks(question);

  if (chunks.length > 0) {
    return chunks;
  }

  return [
    {
      id: "mock-empty-0",
      source: "mock-empty-store",
      chunkIndex: 0,
      content:
        "Nenhum documento real foi encontrado no store mockado. Faça uma ingestão primeiro usando /api/ingest.",
      score: 0,
      metadata: {
        mode: "mock-empty-store",
      },
    },
  ];
}
