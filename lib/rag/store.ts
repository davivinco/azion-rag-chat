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

export type RagDocument = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  chunks: number;
};

const EDGE_SQL_API_BASE = "https://api.azion.com/v4/edge_sql/databases";

function getEnv(name: string): string {
  const azionGlobal = globalThis as typeof globalThis & {
    Azion?: {
      env?: {
        get?: (key: string) => string | undefined;
      };
    };
  };

  const azionValue = azionGlobal.Azion?.env?.get?.(name);
  const nodeValue = process.env[name];

  const value = azionValue || nodeValue;

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

export async function upsertDocument(params: {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status?: string;
}): Promise<void> {
  const statement = `
    INSERT OR REPLACE INTO rag_documents
    (id, filename, content_type, size_bytes, status)
    VALUES (
      ${sqlString(params.id)},
      ${sqlString(params.filename)},
      ${sqlString(params.contentType)},
      ${sqlNumber(params.sizeBytes)},
      ${sqlString(params.status || "indexed")}
    );
  `;

  await executeEdgeSql([statement]);
}

export async function listDocuments(): Promise<RagDocument[]> {
  const result = await executeEdgeSql([
    `
    SELECT
      d.id,
      d.filename,
      d.content_type,
      d.size_bytes,
      d.status,
      d.created_at,
      COUNT(c.id) AS chunks
    FROM rag_documents d
    LEFT JOIN rag_chunks c ON c.source = d.filename
    GROUP BY d.id, d.filename, d.content_type, d.size_bytes, d.status, d.created_at
    ORDER BY d.created_at DESC;
    `,
  ]);

  const rows = result.data?.[0]?.results?.rows ?? [];

  return rows.map((row) => ({
    id: String(row[0]),
    filename: String(row[1]),
    contentType: String(row[2]),
    sizeBytes: Number(row[3] ?? 0),
    status: String(row[4]),
    createdAt: String(row[5]),
    chunks: Number(row[6] ?? 0),
  }));
}

export async function deleteDocumentBySource(source: string): Promise<{
  deletedSource: string;
}> {
  await executeEdgeSql([
    `DELETE FROM rag_chunk_embeddings WHERE source = ${sqlString(source)};`,
    `DELETE FROM rag_chunks WHERE source = ${sqlString(source)};`,
    `DELETE FROM rag_documents WHERE filename = ${sqlString(source)};`,
  ]);

  return {
    deletedSource: source,
  };
}
