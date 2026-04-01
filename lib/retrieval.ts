import { AzionVectorStore } from "@langchain/community/vectorstores/azion_edgesql";
import { AzionAIEmbeddings } from "@/lib/azion-embeddings";

export type RetrievedChunk = {
  pageContent: string;
  metadata?: Record<string, unknown>;
  score?: number;
};

export async function retrieveRelevantChunks(question: string): Promise<RetrievedChunk[]> {
  const embeddings = new AzionAIEmbeddings({
    model: "Qwen/Qwen3-Embedding-4B",
    dimensions: 256,
  });

  const vectorStore = new AzionVectorStore(embeddings, {
    dbName: "ragdatabase",
    tableName: "documents",
  });

  const results = await vectorStore.similaritySearchWithScore(question, 4);

  return results.map(([doc, score]) => ({
    pageContent: doc.pageContent,
    metadata: doc.metadata,
    score,
  }));
}

export function buildContext(docs: RetrievedChunk[]): string {
  return docs
    .map((doc, index) => {
      const fileName = String(doc.metadata?.file_name ?? "desconhecido");
      const page = String(doc.metadata?.page ?? "?");

      return `[Trecho ${index + 1} | arquivo=${fileName} | pagina=${page}]\n${doc.pageContent}`;
    })
    .join("\n\n");
}