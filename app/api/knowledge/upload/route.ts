import { NextRequest, NextResponse } from "next/server";
import {
  extractTextFromKnowledgeFile,
  isKnowledgeUploadFile,
} from "@/lib/rag/file-text";
import { splitTextIntoChunks } from "@/lib/rag/split";
import { saveChunks, upsertDocument } from "@/lib/rag/store";
import { generateEmbedding } from "@/lib/rag/embeddings";
import { saveChunkEmbedding } from "@/lib/rag/vector-store";

export const runtime = "edge";

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!isKnowledgeUploadFile(file)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Arquivo não enviado ou formato inválido.",
          expectedFormField: "file",
        },
        { status: 400 }
      );
    }

    if ((file.size || 0) > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: "Arquivo excede o tamanho máximo permitido.",
          details: "O limite atual para upload é de 5 MB.",
          maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
        },
        { status: 413 }
      );
    }

    const extracted = await extractTextFromKnowledgeFile(file);

    const chunks = splitTextIntoChunks({
      source: extracted.filename,
      text: extracted.text,
      chunkSize: 800,
      overlap: 120,
    });

    await upsertDocument({
      id: extracted.filename,
      filename: extracted.filename,
      contentType: extracted.contentType,
      sizeBytes: extracted.sizeBytes,
      status: "indexed",
    });

    const storeResult = await saveChunks(chunks);

    let savedEmbeddings = 0;

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content);
      await saveChunkEmbedding(chunk, embedding);
      savedEmbeddings += 1;
    }

    return NextResponse.json({
      ok: true,
      mode: "knowledge-upload",
      filename: extracted.filename,
      contentType: extracted.contentType,
      sizeBytes: extracted.sizeBytes,
      totalChunks: chunks.length,
      savedChunks: storeResult.saved,
      totalStoredChunks: storeResult.totalStored,
      savedEmbeddings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao fazer upload para a base de conhecimento.",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
