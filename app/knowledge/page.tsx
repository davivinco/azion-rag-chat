"use client";

import { ChangeEvent, useEffect, useState } from "react";

type KnowledgeDocument = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  chunks: number;
};

type ListResponse = {
  ok: boolean;
  total?: number;
  documents?: KnowledgeDocument[];
  error?: string;
  details?: string;
};

type UploadResponse = {
  ok: boolean;
  mode?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
  totalChunks?: number;
  savedChunks?: number;
  totalStoredChunks?: number;
  savedEmbeddings?: number;
  error?: string;
  details?: string;
};

type DeleteResponse = {
  ok: boolean;
  deletedSource?: string;
  error?: string;
  details?: string;
};
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

async function extractPdfTextInBrowser(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = (pdfjsLib as any).getDocument({
    data: new Uint8Array(arrayBuffer),
    disableWorker: true,
  });

  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const pageText = (textContent.items as Array<{ str?: string }>)
      .map((item) => item.str || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  const text = pages.join("\n\n").trim();

  if (!text) {
    throw new Error("Não foi possível extrair texto do PDF. O arquivo pode estar escaneado ou sem texto selecionável.");
  }

  return text;
}


export default function KnowledgePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingSource, setDeletingSource] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadDocuments() {
    setLoadingList(true);
    setError("");

    try {
      const response = await fetch("/api/knowledge/list");
      const data = (await response.json()) as ListResponse;

      if (!response.ok || !data.ok) {
        setError(data.details || data.error || "Erro ao listar documentos.");
        return;
      }

      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Erro ao listar documentos:", error);
      setError("Erro ao listar documentos.");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setMessage("");
    setError("");
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError("Selecione um arquivo antes de enviar.");
      return;
    }

    if (selectedFile.size > MAX_UPLOAD_SIZE_BYTES) {
      setError("Arquivo excede o limite máximo de 5 MB.");
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const isPdf = selectedFile.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        const text = await extractPdfTextInBrowser(selectedFile);

        const response = await fetch("/api/ingest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source: selectedFile.name,
            text,
            contentType: selectedFile.type || "application/pdf",
            chunkSize: 800,
            overlap: 120,
            generateEmbeddings: true,
          }),
        });

        const data = (await response.json()) as UploadResponse;

        if (!response.ok || !data.ok) {
          setError(data.details || data.error || "Erro ao processar PDF.");
          return;
        }

        setMessage(
          `PDF indexado: ${selectedFile.name} · chunks: ${data.totalChunks} · embeddings: ${data.savedEmbeddings}`
        );
        setSelectedFile(null);

        const input = document.getElementById("knowledge-file") as HTMLInputElement | null;
        if (input) input.value = "";

        await loadDocuments();
        return;
      }

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as UploadResponse;

      if (!response.ok || !data.ok) {
        setError(data.details || data.error || "Erro ao fazer upload.");
        return;
      }

      setMessage(
        `Upload concluído: ${data.filename} · chunks: ${data.totalChunks} · embeddings: ${data.savedEmbeddings}`
      );
      setSelectedFile(null);

      const input = document.getElementById("knowledge-file") as HTMLInputElement | null;
      if (input) input.value = "";

      await loadDocuments();
    } catch (error) {
      console.error("Erro no upload:", error);
      setError("Erro ao fazer upload.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(source: string) {
    const confirmed = window.confirm(`Remover "${source}" da base de conhecimento?`);

    if (!confirmed) return;

    setDeletingSource(source);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/knowledge/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source }),
      });

      const data = (await response.json()) as DeleteResponse;

      if (!response.ok || !data.ok) {
        setError(data.details || data.error || "Erro ao remover documento.");
        return;
      }

      setMessage(`Documento removido: ${data.deletedSource}`);
      await loadDocuments();
    } catch (error) {
      console.error("Erro ao remover documento:", error);
      setError("Erro ao remover documento.");
    } finally {
      setDeletingSource("");
    }
  }

  function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes)) return "-";

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Base de Conhecimento</h1>
              <p className="mt-2 text-sm text-neutral-400">
                Faça upload, liste e remova documentos usados pelo RAG.
              </p>
            </div>

            <a
              href="/"
              className="rounded-xl border border-neutral-700 px-4 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800"
            >
              Voltar ao chat
            </a>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <p className="mb-3 text-sm font-medium text-neutral-300">
              Upload de arquivo
            </p>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                id="knowledge-file"
                type="file"
                accept=".txt,.md,.html,.htm,.pdf,text/plain,text/markdown,text/html,application/pdf"
                onChange={handleFileChange}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:font-medium file:text-black"
              />

              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? "Enviando..." : "Enviar"}
              </button>
            </div>

            <p className="mt-3 text-xs text-neutral-500">
              Formatos suportados agora: .txt, .md, .html, .htm e .pdf até 5 MB.
            </p>
          </div>

          {message ? (
            <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 whitespace-pre-wrap rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Documentos indexados</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Arquivos registrados na tabela rag_documents.
              </p>
            </div>

            <button
              type="button"
              onClick={loadDocuments}
              disabled={loadingList}
              className="rounded-xl border border-neutral-700 px-4 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-50"
            >
              {loadingList ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
              Nenhum documento encontrado.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-800">
              <div className="grid grid-cols-[1.5fr_0.8fr_0.5fr_0.6fr_0.5fr] gap-3 bg-neutral-950 p-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                <span>Arquivo</span>
                <span>Tipo</span>
                <span>Tamanho</span>
                <span>Chunks</span>
                <span>Ação</span>
              </div>

              <div className="divide-y divide-neutral-800">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="grid grid-cols-[1.5fr_0.8fr_0.5fr_0.6fr_0.5fr] gap-3 p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-neutral-100">
                        {document.filename}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {document.status} · {document.createdAt}
                      </p>
                    </div>

                    <span className="text-neutral-300">{document.contentType}</span>
                    <span className="text-neutral-300">
                      {formatBytes(document.sizeBytes)}
                    </span>
                    <span className="text-neutral-300">{document.chunks}</span>

                    <button
                      type="button"
                      onClick={() => handleDelete(document.filename)}
                      disabled={deletingSource === document.filename}
                      className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-200 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {deletingSource === document.filename ? "..." : "Remover"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
