import { NextResponse } from "next/server";
import { listDocuments } from "@/lib/rag/store";

export const runtime = "edge";

export async function GET() {
  try {
    const documents = await listDocuments();

    return NextResponse.json({
      ok: true,
      mode: "knowledge-list",
      total: documents.length,
      documents,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao listar base de conhecimento.",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
