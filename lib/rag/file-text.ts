export type SupportedKnowledgeFile = {
  filename: string;
  contentType: string;
  text: string;
  sizeBytes: number;
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

export async function extractTextFromKnowledgeFile(file: File): Promise<SupportedKnowledgeFile> {
  const filename = file.name;
  const extension = getExtension(filename);

  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new Error(
      `Formato não suportado: ${extension || "sem extensão"}. Suportados: ${SUPPORTED_EXTENSIONS.join(", ")}`
    );
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
    contentType: file.type || "text/plain",
    text,
    sizeBytes: file.size,
  };
}
