import { RagDocumentChunk, RetrievedChunk } from "./types";

type EdgeSqlQueryResponse = {
  state?: string;
  data?: Array<{
    results?: {
      columns?: string[];
      rows?: unknown[][];
      rows_read?: number;
      rows_written?: number;
      query_duration_ms?: number;
    };
  }>;
  errors?: Array<{
    code?: string;
    title?: string;
    detail?: string;
    status?: string;
  }>;
};

type SaveChunksResult = {
  saved: number;
  totalStored: number;
};

const EDGE_SQL_API_BASE = "https://api.azion.com/v4/edge_sql/databases";

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variável de ambiente não configurada: ${name}`);
  }

  return value;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(value);
}

function chunkToInsertStatement(chunk: RagDocumentChunk): string {
  const metadata = chunk.metadata ? JSON.stringify(chunk.metadata) : "{}";

  return [
    "INSERT OR REPLACE INTO rag_chunks",
    "(id, source, chunk_index, content, metadata)",
    "VALUES",
    `(${sqlString(chunk.id)}, ${sqlString(chunk.source)}, ${sqlNumber(
      chunk.chunkIndex
    )}, ${sqlString(chunk.content)}, ${sqlString(metadata)});`,
  ].join(" ");
}

async function executeEdgeSql(statements: string[]): Promise<EdgeSqlQueryResponse> {
  const token = getEnv("AZION_PERSONAL_TOKEN");
  const databaseId = getEnv("EDGE_SQL_DATABASE_ID");

  const response = await fetch(`${EDGE_SQL_API_BASE}/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ statements }),
  });

  const data = (await response.json()) as EdgeSqlQueryResponse;

  if (!response.ok || data.errors?.length) {
    throw new Error(
      JSON.stringify(
        {
          status: response.status,
          errors: data.errors,
        },
        null,
        2
      )
    );
  }

  return data;
}

function mapRowToChunk(row: unknown[]): RagDocumentChunk {
  const [id, source, chunkIndex, content, metadata] = row;

  let parsedMetadata: RagDocumentChunk["metadata"] = {};

  if (typeof metadata === "string" && metadata.trim()) {
    try {
      parsedMetadata = JSON.parse(metadata);
    } catch {
      parsedMetadata = {
        rawMetadata: metadata,
      };
    }
  }

  return {
    id: String(id),
    source: String(source),
    chunkIndex: Number(chunkIndex),
    content: String(content),
    metadata: parsedMetadata,
  };
}

function calculateSimpleScore(question: string, content: string): number {
  const normalizedQuestion = question.toLowerCase();
  const normalizedContent = content.toLowerCase();

  if (normalizedContent.includes(normalizedQuestion)) return 1;

  const terms = normalizedQuestion
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);

  if (!terms.length) return 0;

  const matches = terms.filter((term) => normalizedContent.includes(term));

  return matches.length / terms.length;
}

export async function saveChunks(chunks: RagDocumentChunk[]): Promise<SaveChunksResult> {
  if (!chunks.length) {
    return {
      saved: 0,
      totalStored: await countChunks(),
    };
  }

  const statements = chunks.map(chunkToInsertStatement);
  await executeEdgeSql(statements);

  return {
    saved: chunks.length,
    totalStored: await countChunks(),
  };
}

export async function countChunks(): Promise<number> {
  const result = await executeEdgeSql([
    "SELECT COUNT(*) AS total FROM rag_chunks;",
  ]);

  const row = result.data?.[0]?.results?.rows?.[0];
  const total = row?.[0];

  return Number(total ?? 0);
}

export async function listChunks(): Promise<RagDocumentChunk[]> {
  const result = await executeEdgeSql([
    "SELECT id, source, chunk_index, content, metadata FROM rag_chunks ORDER BY created_at DESC LIMIT 100;",
  ]);

  const rows = result.data?.[0]?.results?.rows ?? [];

  return rows.map(mapRowToChunk);
}

export async function searchChunks(question: string): Promise<RetrievedChunk[]> {
  const chunks = await listChunks();

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: calculateSimpleScore(question, chunk.content),
    }))
    .filter((chunk) => Number(chunk.score) > 0)
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 5);
}
