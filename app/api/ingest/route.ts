import { NextRequest, NextResponse } from "next/server";
import { splitTextIntoChunks } from "@/lib/rag/split";
import { saveChunks, upsertDocument } from "@/lib/rag/store";
import { generateEmbedding } from "@/lib/rag/embeddings";
import { saveChunkEmbedding } from "@/lib/rag/vector-store";

export const runtime = "edge";

const MAX_INGEST_SIZE_BYTES = 5 * 1024 * 1024;

type IngestRequestBody = {
  source?: string;
  text?: string;
  contentType?: string;
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

    const sizeBytes = new TextEncoder().encode(text).length;

    if (sizeBytes > MAX_INGEST_SIZE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: "Payload excede o tamanho máximo permitido.",
          details: "O limite atual para ingestão é de 5 MB.",
          maxSizeBytes: MAX_INGEST_SIZE_BYTES,
          receivedSizeBytes: sizeBytes,
        },
        { status: 413 }
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
      contentType: body.contentType?.trim() || "text/plain",
      sizeBytes,
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
