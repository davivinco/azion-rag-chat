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

async function callChatModel(messages: Array<{ role: "system" | "user"; content: string }>) {
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
      max_tokens: 1800,
      temperature: 0.15,
      top_p: 0.9,
      messages,
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

export async function generateAnswerWithContext(params: {
  question: string;
  context: string;
}): Promise<string> {
  return callChatModel([
    {
      role: "system",
      content:
        "Você é um especialista técnico em cloud, edge computing, RAG, bancos vetoriais e documentação técnica. " +
        "Responda usando SOMENTE o contexto recuperado da base de conhecimento. " +
        "Não seja genérico. Use dados, nomes, componentes, limites e detalhes concretos presentes no contexto. " +
        "A resposta DEVE estar em Markdown válido e bem formatado. " +
        "Use títulos com ## e ###. " +
        "Use listas com bullets quando houver itens. " +
        "Use tabelas Markdown reais quando houver comparação ou relação entre componente e função. " +
        "Nunca use texto tabulado com TAB. Nunca escreva títulos soltos como 'AI Inference:' ou 'Edge SQL:' sem ##, ### ou bullet. " +
        "Separe blocos com linhas em branco. Evite parágrafos longos. " +
        "Se o contexto não tiver informação suficiente, diga isso claramente. " +
        "Responda em português do Brasil, com linguagem profissional e útil para apresentação a cliente.",
    },
    {
      role: "user",
      content:
        `Pergunta do usuário:\n${params.question}\n\n` +
        `Contexto recuperado da base de conhecimento:\n${params.context}\n\n` +
        "FORMATO OBRIGATÓRIO DA RESPOSTA:\n\n" +
        "1. Comece com uma frase curta respondendo diretamente a pergunta.\n\n" +
        "2. Depois use esta estrutura sempre que fizer sentido:\n\n" +
        "## Visão geral\n\n" +
        "Explique em 1 ou 2 frases.\n\n" +
        "## Componentes principais\n\n" +
        "| Componente | Função |\n" +
        "|---|---|\n" +
        "| Nome do componente | Papel dentro da solução |\n\n" +
        "## Fluxo de funcionamento\n\n" +
        "1. Primeiro passo.\n" +
        "2. Segundo passo.\n" +
        "3. Terceiro passo.\n\n" +
        "## Resumo prático\n\n" +
        "Feche com uma síntese objetiva.\n\n" +
        "REGRAS IMPORTANTES:\n" +
        "- Use Markdown válido.\n" +
        "- Não use TAB para alinhar texto.\n" +
        "- Não escreva blocos como texto solto.\n" +
        "- Não escreva 'Componente Função' sem tabela Markdown.\n" +
        "- Para tabelas, use obrigatoriamente pipes: | Coluna | Coluna |.\n" +
        "- Destaque termos importantes em **negrito**.\n" +
        "- Não mencione chunks, embeddings ou retrieval, exceto se a pergunta for sobre o funcionamento do RAG.",
    },
  ]);
}

export async function generateGeneralAnswer(question: string): Promise<string> {
  return callChatModel([
    {
      role: "system",
      content:
        "Você é um assistente técnico útil, objetivo e confiável. " +
        "Responda com conhecimento geral do modelo, sem afirmar que consultou a base de conhecimento. " +
        "Use sempre Markdown válido, com títulos, listas e tabelas quando fizer sentido. " +
        "Nunca use texto tabulado com TAB. Para tabelas, use pipes Markdown. " +
        "Separe blocos com linhas em branco e evite parágrafos longos. " +
        "Se a pergunta depender de dados atuais, informe que é necessário validar em uma fonte atualizada. " +
        "Responda em português do Brasil.",
    },
    {
      role: "user",
      content:
        `Pergunta:\n${question}\n\n` +
        "Responda de forma objetiva, prática e bem estruturada em Markdown válido.",
    },
  ]);
}

