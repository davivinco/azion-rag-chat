export type SupportedKnowledgeFile = {
  filename: string;
  contentType: string;
  text: string;
  sizeBytes: number;
};

type FileLike = FormDataEntryValue & {
  name?: string;
  type?: string;
  size?: number;
  text?: () => Promise<string>;
};

const SUPPORTED_EXTENSIONS = [".txt", ".md", ".html", ".htm"];

function getExtension(filename: string): string {
  const lower = filename.toLowerCase();
  const dotIndex = lower.lastIndexOf(".");
  return dotIndex >= 0 ? lower.slice(dotIndex) : "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getContentTypeByExtension(extension: string, fallback?: string): string {
  if (fallback) return fallback;

  if (extension === ".md") return "text/markdown";
  if (extension === ".html" || extension === ".htm") return "text/html";

  return "text/plain";
}

export function isKnowledgeUploadFile(
  value: FormDataEntryValue | null
): value is FileLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "text" in value &&
    typeof (value as FileLike).text === "function"
  );
}

export async function extractTextFromKnowledgeFile(
  file: FileLike
): Promise<SupportedKnowledgeFile> {
  const filename = file.name || "knowledge-upload.txt";
  const extension = getExtension(filename);

  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new Error(
      `Formato não suportado: ${
        extension || "sem extensão"
      }. Suportados: ${SUPPORTED_EXTENSIONS.join(", ")}`
    );
  }

  if (typeof file.text !== "function") {
    throw new Error("Arquivo inválido: método text() não disponível.");
  }

  const rawText = await file.text();

  const text =
    extension === ".html" || extension === ".htm"
      ? stripHtml(rawText)
      : rawText.trim();

  if (!text) {
    throw new Error("Não foi possível extrair texto do arquivo.");
  }

  return {
    filename,
    contentType: getContentTypeByExtension(extension, file.type),
    text,
    sizeBytes: file.size || new TextEncoder().encode(rawText).length,
  };
}
