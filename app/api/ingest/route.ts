import { NextRequest, NextResponse } from "next/server";
import { splitTextIntoChunks } from "@/lib/rag/split";

type IngestRequestBody = {
  source?: string;
  text?: string;
  chunkSize?: number;
  overlap?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as IngestRequestBody;

    const source = body.source?.trim() || "manual-input";
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json(
        {
          ok: false,
          error: "Texto não informado.",
          expectedPayloadExample: {
            source: "documento-teste.txt",
            text: "Conteúdo do documento para ingestão.",
          },
        },
        { status: 400 }
      );
    }

    const chunks = splitTextIntoChunks({
      source,
      text,
      chunkSize: body.chunkSize,
      overlap: body.overlap,
    });

    return NextResponse.json({
      ok: true,
      mode: "mock-ingest",
      source,
      totalChunks: chunks.length,
      chunks,
    });
  } catch (error) {
    console.error("Erro ao processar /api/ingest:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao processar ingestão.",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
