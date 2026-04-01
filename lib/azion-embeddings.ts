import { Embeddings } from "@langchain/core/embeddings";

declare const Azion: any;

type EmbeddingConfig = {
  model?: string;
  dimensions?: 256 | 512 | 1024 | 2048 | 4096;
};

export class AzionAIEmbeddings extends Embeddings {
  private model: string;
  private dimensions: 256 | 512 | 1024 | 2048 | 4096;

  constructor(config: EmbeddingConfig = {}) {
    super({});
    this.model = config.model ?? "Qwen/Qwen3-Embedding-4B";
    this.dimensions = config.dimensions ?? 256;
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await Azion.AI.run(this.model, {
      input: text,
      encoding_format: "float",
      dimensions: this.dimensions,
    });

    return response.data[0].embedding;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];

    for (const text of texts) {
      vectors.push(await this.embedQuery(text));
    }

    return vectors;
  }
}