import { NextRequest, NextResponse } from "next/server";
import { splitTextIntoChunks } from "@/lib/rag/split";
import { saveChunks, upsertDocument } from "@/lib/rag/store";
import { generateEmbedding } from "@/lib/rag/embeddings";
import { saveChunkEmbedding } from "@/lib/rag/vector-store";

export const runtime = "edge";

type IngestRequestBody = {
  source?: string;
  text?: string;
  chunkSize?: number;
  overlap?: number;
  generateEmbeddings?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as IngestRequestBody;

    const source = body.source?.trim() || "manual-input";
    const text = body.text?.trim();
    const shouldGenerateEmbeddings = body.generateEmbeddings !== false;

    if (!text) {
      return NextResponse.json(
        {
          ok: false,
          error: "Texto não informado.",
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

    await upsertDocument({
      id: source,
      filename: source,
      contentType: "text/plain",
      sizeBytes: new TextEncoder().encode(text).length,
      status: "indexed",
    });

    const storeResult = await saveChunks(chunks);

    let savedEmbeddings = 0;

    if (shouldGenerateEmbeddings) {
      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk.content);
        await saveChunkEmbedding(chunk, embedding);
        savedEmbeddings += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "edge-sql-vector-ingest",
      source,
      totalChunks: chunks.length,
      savedChunks: storeResult.saved,
      totalStoredChunks: storeResult.totalStored,
      savedEmbeddings,
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
