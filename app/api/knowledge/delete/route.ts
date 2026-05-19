import { NextRequest, NextResponse } from "next/server";
import { deleteDocumentBySource } from "@/lib/rag/store";

export const runtime = "edge";

type DeleteRequestBody = {
  source?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DeleteRequestBody;
    const source = body.source?.trim();

    if (!source) {
      return NextResponse.json(
        {
          ok: false,
          error: "Source não informado.",
          expectedPayloadExample: {
            source: "documento.pdf",
          },
        },
        { status: 400 }
      );
    }

    const result = await deleteDocumentBySource(source);

    return NextResponse.json({
      ok: true,
      mode: "knowledge-delete",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao remover documento da base de conhecimento.",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
