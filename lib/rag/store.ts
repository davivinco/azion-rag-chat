import { RagDocumentChunk, RetrievedChunk } from "./types";

const globalForRagStore = globalThis as unknown as {
  ragChunks?: RagDocumentChunk[];
};

function getMemoryStore(): RagDocumentChunk[] {
  if (!globalForRagStore.ragChunks) {
    globalForRagStore.ragChunks = [];
  }

  return globalForRagStore.ragChunks;
}

export async function saveChunks(chunks: RagDocumentChunk[]): Promise<{
  saved: number;
  totalStored: number;
}> {
  const store = getMemoryStore();

  store.push(...chunks);

  return {
    saved: chunks.length,
    totalStored: store.length,
  };
}

export async function listChunks(): Promise<RagDocumentChunk[]> {
  return getMemoryStore();
}

export async function searchChunks(question: string): Promise<RetrievedChunk[]> {
  const store = getMemoryStore();

  const normalizedQuestion = question.toLowerCase();

  const results = store
    .map((chunk) => {
      const normalizedContent = chunk.content.toLowerCase();

      const score = normalizedContent.includes(normalizedQuestion)
        ? 1
        : calculateSimpleScore(normalizedQuestion, normalizedContent);

      return {
        ...chunk,
        score,
      };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 5);

  return results;
}

function calculateSimpleScore(question: string, content: string): number {
  const terms = question
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (!terms.length) return 0;

  const matches = terms.filter((term) => content.includes(term));

  return matches.length / terms.length;
}
