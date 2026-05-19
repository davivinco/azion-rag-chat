import { RagDocumentChunk, RetrievedChunk } from "./types";

type EdgeSqlQueryResponse = {
  state?: string;
  data?: Array<{
    results?: {
      columns?: string[];
      rows?: unknown[][];
    };
  }>;
  errors?: Array<{
    code?: string;
    title?: string;
    detail?: string;
    status?: string;
  }>;
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

function vectorSql(embedding: number[]): string {
  return `vector('[${embedding.join(",")}]')`;
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

export async function saveChunkEmbedding(
  chunk: RagDocumentChunk,
  embedding: number[]
): Promise<void> {
  const metadata = chunk.metadata ? JSON.stringify(chunk.metadata) : "{}";

  const statement = `
    INSERT OR REPLACE INTO rag_chunk_embeddings
    (chunk_id, source, chunk_index, content, embedding, metadata)
    VALUES (
      ${sqlString(chunk.id)},
      ${sqlString(chunk.source)},
      ${chunk.chunkIndex},
      ${sqlString(chunk.content)},
      ${vectorSql(embedding)},
      ${sqlString(metadata)}
    );
  `;

  await executeEdgeSql([statement]);
}

export async function searchSimilarChunksByEmbedding(
  embedding: number[],
  limit = 5,
  minScore = 0.6
): Promise<RetrievedChunk[]> {
  const statement = `
    SELECT
      chunk_id,
      source,
      chunk_index,
      content,
      metadata,
      vector_distance_cos(embedding, ${vectorSql(embedding)}) AS distance
    FROM rag_chunk_embeddings
    ORDER BY distance ASC
    LIMIT ${limit};
  `;

  const result = await executeEdgeSql([statement]);
  const rows = result.data?.[0]?.results?.rows ?? [];

  return rows
    .map((row) => {
      const [id, source, chunkIndex, content, metadata, distance] = row;

      let parsedMetadata: RetrievedChunk["metadata"] = {};

      if (typeof metadata === "string" && metadata.trim()) {
        try {
          parsedMetadata = JSON.parse(metadata);
        } catch {
          parsedMetadata = {
            rawMetadata: metadata,
          };
        }
      }

      const score = 1 - Number(distance ?? 1);

      return {
        id: String(id),
        source: String(source),
        chunkIndex: Number(chunkIndex),
        content: String(content),
        metadata: parsedMetadata,
        score,
      };
    })
    .filter((chunk) => Number(chunk.score) >= minScore)
    .sort((a, b) => Number(b.score) - Number(a.score));
}
