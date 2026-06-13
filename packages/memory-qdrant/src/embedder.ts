import OpenAI from 'openai';

export const EMBEDDING_DIMENSIONS = 1536;

export type Embedder = {
  embed: (args: { texts: string[] }) => Promise<number[][]>;
};

export const createOpenAIEmbedder = ({
  apiKey,
  model = 'text-embedding-3-small',
}: {
  apiKey: string;
  model?: string;
}): Embedder => {
  const client = new OpenAI({ apiKey });

  return {
    embed: async ({ texts }) => {
      if (texts.length === 0) {
        return [];
      }
      const response = await client.embeddings.create({ model, input: texts });
      return response.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((entry) => entry.embedding);
    },
  };
};
