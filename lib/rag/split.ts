import { RagDocumentChunk } from "./types";

type SplitTextParams = {
  source: string;
  text: string;
  chunkSize?: number;
  overlap?: number;
};

function sanitizeText(text: string): string {
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function splitTextIntoChunks({
  source,
  text,
  chunkSize = 800,
  overlap = 120,
}: SplitTextParams): RagDocumentChunk[] {
  const normalized = sanitizeText(text);

  if (!normalized) return [];

  const chunks: RagDocumentChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const content = normalized.slice(start, end).trim();

    if (content) {
      chunks.push({
        id: `${source}-${chunkIndex}`,
        source,
        chunkIndex,
        content,
      });
    }

    if (end >= normalized.length) break;

    start = Math.max(end - overlap, start + 1);
    chunkIndex += 1;
  }

  return chunks;
}
