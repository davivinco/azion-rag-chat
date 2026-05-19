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

    const extracted = await extractTextFromKnowledgeFile(file);

    const chunks = splitTextIntoChunks({
      source: extracted.filename,
      text: extracted.text,
      chunkSize: 1200,
      overlap: 180,
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
