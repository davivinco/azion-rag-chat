export type RagDocumentChunk = {
  id: string;
  source: string;
  chunkIndex: number;
  content: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type RetrievedChunk = RagDocumentChunk & {
  score?: number;
};

export type ChatAnswer = {
  answer: string;
  chunks?: RetrievedChunk[];
};
