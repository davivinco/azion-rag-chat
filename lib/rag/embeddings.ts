type EmbeddingsResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
  error?: unknown;
};

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

function getOptionalEnv(name: string, fallback: string): string {
  const azionGlobal = globalThis as typeof globalThis & {
    Azion?: {
      env?: {
        get?: (key: string) => string | undefined;
      };
    };
  };

  return azionGlobal.Azion?.env?.get?.(name) || process.env[name] || fallback;
}

export async function generateEmbedding(input: string): Promise<number[]> {
  const endpoint = getEnv("EMBEDDINGS_API_URL");
  const apiKey = getEnv("EMBEDDINGS_API_KEY");
  const apiKeyHeader = getOptionalEnv("EMBEDDINGS_API_KEY_HEADER", "Authorization");
  const model = getOptionalEnv("EMBEDDINGS_MODEL", "Qwen/Qwen3-Embedding-4B");
  const dimensions = Number(getOptionalEnv("EMBEDDINGS_DIMENSIONS", "256"));

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKeyHeader.toLowerCase() === "authorization") {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    headers[apiKeyHeader] = apiKey;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      input,
      encoding_format: "float",
      dimensions,
    }),
  });

  const data = (await response.json()) as EmbeddingsResponse;

  if (!response.ok) {
    throw new Error(
      `Erro ao gerar embedding: ${response.status} ${JSON.stringify(data)}`
    );
  }

  const embedding = data.data?.[0]?.embedding;

  if (!embedding?.length) {
    throw new Error("Resposta de embedding sem vetor válido.");
  }

  return embedding;
}
