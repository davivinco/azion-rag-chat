import { NextResponse } from "next/server";
import { insufficientContextResponse } from "@/lib/guardrails";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = String(body?.message ?? "").trim();

    if (!question) {
      return NextResponse.json(
        { error: "Pergunta não informada." },
        { status: 400 }
      );
    }

    return NextResponse.json(insufficientContextResponse());
  } catch (error) {
    return NextResponse.json(
      {
        error: "Erro ao processar a requisição.",
      },
      { status: 500 }
    );
  }
}