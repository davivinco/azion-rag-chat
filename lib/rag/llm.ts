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
        "Sua função é responder com alta precisão usando SOMENTE o contexto recuperado da base de conhecimento. " +
        "Não seja genérico. Extraia diferenças, valores, nomes, limites, componentes, fluxos e detalhes concretos do contexto. " +
        "Responda sempre em Markdown válido, com boa hierarquia visual e leitura fácil. " +
        "Use títulos com ## e ### quando a resposta tiver mais de um bloco. " +
        "Use listas com bullets ou numeração quando houver sequência de passos. " +
        "Use tabelas Markdown reais com pipes, por exemplo: | Item | Descrição |. Nunca use texto tabulado com TAB. " +
        "Separe blocos com linhas em branco. Evite parágrafos longos. " +
        "Quando a pergunta pedir comparação, use uma tabela Markdown e depois um resumo objetivo. " +
        "Quando houver números, preços, regiões, limites ou nomes técnicos no contexto, preserve esses dados. " +
        "Se o contexto não trouxer informação suficiente, diga claramente o que não foi encontrado. " +
        "Não invente fontes, números ou capacidades que não estejam no contexto. " +
        "Responda em português do Brasil, com linguagem profissional, direta e útil para apresentação a cliente.",
    },
    {
      role: "user",
      content:
        `Pergunta do usuário:\n${params.question}\n\n` +
        `Contexto recuperado da base de conhecimento:\n${params.context}\n\n` +
        "Instruções de resposta:\n" +
        "- Responda diretamente a pergunta.\n" +
        "- Comece com um resumo curto de 1 a 2 frases.\n" +
        "- Separe a resposta em blocos com títulos Markdown, usando ## ou ###.\n" +
        "- Use listas com indentação correta.\n" +
        "- Use tabela Markdown quando houver comparação, etapas, recursos, limites ou preços.\n" +
        "- Nunca use tabela com TAB; use sempre pipes: | Coluna | Coluna |.\n" +
        "- Destaque pontos importantes em negrito.\n" +
        "- Evite texto corrido grande.\n" +
        "- Não inclua introduções longas.\n" +
        "- Não diga que é uma IA.\n" +
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
        "Se a pergunta depender de dados atuais, preços, status, disponibilidade, versões ou fatos que possam mudar, informe que é necessário validar em uma fonte atualizada. " +
        "Evite respostas genéricas. Estruture a resposta com clareza, exemplos e próximos passos quando fizer sentido. " +
        "Use sempre Markdown válido, com títulos, listas e tabelas quando fizer sentido. " +
        "Nunca use texto tabulado com TAB; para tabelas, use pipes Markdown. " +
        "Separe blocos com linhas em branco e evite parágrafos longos. " +
        "Responda em português do Brasil.",
    },
    {
      role: "user",
      content:
        `Pergunta:\n${question}\n\n` +
        "Responda de forma objetiva, prática e bem estruturada.",
    },
  ]);
}
