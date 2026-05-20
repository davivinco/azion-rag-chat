type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
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

export async function generateAnswerWithContext(params: {
  question: string;
  context: string;
}): Promise<string> {
  const endpoint = getEnv("CHAT_API_URL");
  const apiKey = getEnv("CHAT_API_KEY");
  const apiKeyHeader = getOptionalEnv("CHAT_API_KEY_HEADER", "X-API-Key");
  const model = getOptionalEnv(
    "CHAT_MODEL",
    "casperhansen-mistral-small-24b-instruct-2501-awq"
  );

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
      stream: false,
      max_tokens: 1200,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente RAG útil, objetivo e confiável. Responda somente com base no contexto fornecido. Se o contexto não tiver informação suficiente, diga isso claramente.",
        },
        {
          role: "user",
          content:
            `Pergunta:\n${params.question}\n\n` +
            `Contexto recuperado:\n${params.context}\n\n` +
            "Responda em português do Brasil, de forma objetiva.",
        },
      ],
    }),
  });

  const data = (await response.json()) as ChatCompletionResponse;

  if (!response.ok) {
    throw new Error(
      `Erro ao gerar resposta no modelo: ${response.status} ${JSON.stringify(data)}`
    );
  }

  const answer = data.choices?.[0]?.message?.content;

  if (!answer?.trim()) {
    throw new Error("Resposta do modelo veio vazia.");
  }

  return answer.trim();
}
