type EdgeSqlResponse = {
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

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }

  return value;
}

export async function executeEdgeSql(statements: string[]): Promise<EdgeSqlResponse> {
  const token = getRequiredEnv("AZION_PERSONAL_TOKEN");
  const databaseId = getRequiredEnv("EDGE_SQL_DATABASE_ID");

  const response = await fetch(
    `https://api.azion.com/v4/edge_sql/databases/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ statements }),
    }
  );

  const data = (await response.json()) as EdgeSqlResponse;

  if (!response.ok || data.errors?.length) {
    throw new Error(
      `Erro ao executar Edge SQL: ${JSON.stringify(data.errors ?? data)}`
    );
  }

  return data;
}

export function escapeSqlValue(value: string): string {
  return value.replace(/'/g, "''");
}
