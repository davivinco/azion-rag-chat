import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const API_URL =
  process.env.RAG_INGEST_URL ||
  "https://kkcutuewg8u.map.azionedge.net/api/ingest";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Uso: node scripts/ingest-pdf.mjs caminho/do/arquivo.pdf");
  process.exit(1);
}

async function main() {
  const absolutePath = path.resolve(filePath);
  const fileBuffer = await fs.readFile(absolutePath);
  const fileName = path.basename(absolutePath);

  console.log(`Lendo PDF: ${fileName}`);

  const parsed = await pdf(fileBuffer);
  const text = parsed.text?.trim();

  if (!text) {
    throw new Error("Não foi possível extrair texto do PDF.");
  }

  console.log(`Texto extraído: ${text.length} caracteres`);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: fileName,
      text,
      chunkSize: 1200,
      overlap: 180,
      generateEmbeddings: true,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    console.error("Erro na ingestão:");
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("PDF ingerido com sucesso:");
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error("Falha ao ingerir PDF:");
  console.error(error);
  process.exit(1);
});
