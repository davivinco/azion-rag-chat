export const runtime = "edge";

import { NextResponse } from "next/server";
import {
  insufficientContextResponse,
  validateRetrievedContext,
} from "@/lib/guardrails";

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

    const isLocalDev = process.env.NODE_ENV === "development";

    if (isLocalDev) {
      return NextResponse.json({
        answer:
          "Ambiente local ativo. O retrieval com Azion SQL e Azion AI será validado no deploy da Azion.",
        status: "LOCAL_DEV_BYPASS",
        sources: [],
      });
    }

    const { buildContext, retrieveRelevantChunks } = await import("@/lib/retrieval");

    const docs = await retrieveRelevantChunks(question);
    const guardrail = validateRetrievedContext(docs);

    if (!guardrail.allowed) {
      return NextResponse.json({
        ...insufficientContextResponse(),
        reason: guardrail.reason,
      });
    }

    const context = buildContext(docs);

    return NextResponse.json({
      answer: "Contexto recuperado com sucesso.",
      status: "CONTEXT_FOUND",
      reason: null,
      context,
      sources: docs.map((doc) => ({
        file_name: doc.metadata?.file_name ?? null,
        source_key: doc.metadata?.source_key ?? null,
        page: doc.metadata?.page ?? null,
        chunk_id: doc.metadata?.chunk_id ?? null,
        score: doc.score ?? null,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Erro ao processar a requisição.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}