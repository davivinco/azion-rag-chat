import { NextRequest, NextResponse } from "next/server";
import { generateMockRagAnswer } from "@/lib/rag/answer";

export const runtime = "edge";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatRequestBody = {
  message?: string;
  prompt?: string;
  question?: string;
  pergunta?: string;
  messages?: ChatMessage[];
};

function getUserQuestion(body: ChatRequestBody): string {
  if (body.message?.trim()) return body.message.trim();
  if (body.prompt?.trim()) return body.prompt.trim();
  if (body.question?.trim()) return body.question.trim();
  if (body.pergunta?.trim()) return body.pergunta.trim();

  const lastUserMessage = body.messages
    ?.slice()
    .reverse()
    .find((msg) => msg.role === "user");

  return lastUserMessage?.content?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const userQuestion = getUserQuestion(body);

    if (!userQuestion) {
      return NextResponse.json(
        {
          ok: false,
          error: "Pergunta não informada.",
          acceptedFields: ["message", "prompt", "question", "pergunta", "messages"],
        },
        { status: 400 }
      );
    }

    const result = await generateMockRagAnswer(userQuestion);

    return NextResponse.json({
      ok: true,
      mode: "edge-sql-vector-rag",
      answer: result.answer,
      sources: result.sources,
      chunks: result.chunks,
    });
  } catch (error) {
    console.error("Erro ao processar /api/chat:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao processar a requisição.",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
