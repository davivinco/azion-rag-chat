import { RagDocumentChunk } from "./types";

type SplitTextParams = {
  source: string;
  text: string;
  chunkSize?: number;
  overlap?: number;
};

function sanitizeText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();
}

function findSafeEnd(text: string, start: number, maxEnd: number): number {
  if (maxEnd >= text.length) return text.length;

  const slice = text.slice(start, maxEnd);
  const lastSpace = slice.lastIndexOf(" ");

  if (lastSpace <= 0) return maxEnd;

  return start + lastSpace;
}

function findSafeStart(text: string, desiredStart: number): number {
  if (desiredStart <= 0) return 0;

  const nextSpace = text.indexOf(" ", desiredStart);

  if (nextSpace === -1) return desiredStart;

  return nextSpace + 1;
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
    const maxEnd = Math.min(start + chunkSize, normalized.length);
    const end = findSafeEnd(normalized, start, maxEnd);
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

    const nextStart = Math.max(end - overlap, start + 1);
    start = findSafeStart(normalized, nextStart);
    chunkIndex += 1;
  }

  return chunks;
}
