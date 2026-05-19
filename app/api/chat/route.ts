import { NextRequest, NextResponse } from "next/server";
import { generateMockRagAnswer } from "@/lib/rag/answer";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatRequestBody = {
  messages?: ChatMessage[];
  prompt?: string;
};

function getLastUserMessage(messages?: ChatMessage[], prompt?: string): string {
  if (prompt && prompt.trim()) return prompt.trim();

  if (!messages?.length) return "";

  const lastUserMessage = [...messages]
    .reverse()
    .find((msg) => msg.role === "user");

  return lastUserMessage?.content?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const userQuestion = getLastUserMessage(body.messages, body.prompt);

    if (!userQuestion) {
      return NextResponse.json(
        {
          ok: false,
          error: "Nenhuma pergunta foi enviada.",
        },
        { status: 400 }
      );
    }

    const result = await generateMockRagAnswer(userQuestion);

    return NextResponse.json({
      ok: true,
      mode: "mock-rag",
      answer: result.answer,
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
