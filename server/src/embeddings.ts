import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL
  });
};

// Initialize Pinecone client (lazy loading)
let pineconeClient: Pinecone | null = null;

const getPineconeClient = () => {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY is not configured');
  }

  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
  }

  return pineconeClient;
};

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || 'acme-legal-docs';
const EMBEDDING_MODEL = 'text-embedding-3-small'; // OpenAI's latest, cheaper embedding model

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

/**
 * Generate embeddings for a given text using OpenAI's embedding model
 */
export const generateEmbedding = async (text: string): Promise<EmbeddingResult> => {
  const openai = getOpenAIClient();

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    encoding_format: 'float'
  });

  return {
    embedding: response.data[0].embedding,
    tokenCount: response.usage.total_tokens
  };
};

/**
 * Generate embeddings for multiple texts in batch
 */
export const generateEmbeddingsBatch = async (texts: string[]): Promise<EmbeddingResult[]> => {
  const openai = getOpenAIClient();

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    encoding_format: 'float'
  });

  return response.data.map((item, index) => ({
    embedding: item.embedding,
    tokenCount: response.usage.total_tokens / texts.length // Approximate per-text token count
  }));
};

/**
 * Store vector embedding in Pinecone
 */
export const storeEmbedding = async (
  id: string,
  embedding: number[],
  metadata: Record<string, any>
): Promise<void> => {
  const pinecone = getPineconeClient();
  const index = pinecone.Index(PINECONE_INDEX_NAME);

  await index.upsert([{
    id,
    values: embedding,
    metadata
  }]);
};

/**
 * Store multiple embeddings in batch
 */
export const storeEmbeddingsBatch = async (
  vectors: Array<{
    id: string;
    embedding: number[];
    metadata: Record<string, any>;
  }>
): Promise<void> => {
  const pinecone = getPineconeClient();
  const index = pinecone.Index(PINECONE_INDEX_NAME);

  await index.upsert(
    vectors.map(v => ({
      id: v.id,
      values: v.embedding,
      metadata: v.metadata
    }))
  );
};

export interface SemanticSearchResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

/**
 * Perform semantic search using vector similarity
 */
export const semanticSearch = async (
  query: string,
  topK: number = 5,
  filter?: Record<string, any>
): Promise<SemanticSearchResult[]> => {
  // Generate embedding for query
  const { embedding } = await generateEmbedding(query);

  // Search Pinecone
  const pinecone = getPineconeClient();
  const index = pinecone.Index(PINECONE_INDEX_NAME);

  const queryResponse = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    ...(filter && { filter })
  });

  return queryResponse.matches.map(match => ({
    id: match.id,
    score: match.score || 0,
    metadata: (match.metadata || {}) as Record<string, any>
  }));
};

/**
 * Delete embedding from Pinecone
 */
export const deleteEmbedding = async (id: string): Promise<void> => {
  const pinecone = getPineconeClient();
  const index = pinecone.Index(PINECONE_INDEX_NAME);

  await index.deleteOne(id);
};

/**
 * Delete multiple embeddings
 */
export const deleteEmbeddingsBatch = async (ids: string[]): Promise<void> => {
  const pinecone = getPineconeClient();
  const index = pinecone.Index(PINECONE_INDEX_NAME);

  await index.deleteMany(ids);
};

/**
 * Chunk text into smaller pieces for embedding
 * OpenAI's embedding model has an 8k token limit
 */
export const chunkText = (text: string, maxChunkSize: number = 1000): string[] => {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();

    if (currentChunk.length + trimmed.length + 2 > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // If single sentence is too long, split it
      if (trimmed.length > maxChunkSize) {
        const words = trimmed.split(' ');
        let wordChunk = '';

        for (const word of words) {
          if (wordChunk.length + word.length + 1 > maxChunkSize) {
            chunks.push(wordChunk.trim());
            wordChunk = word;
          } else {
            wordChunk += (wordChunk.length > 0 ? ' ' : '') + word;
          }
        }

        if (wordChunk.length > 0) {
          currentChunk = wordChunk;
        }
      } else {
        currentChunk = trimmed;
      }
    } else {
      currentChunk += (currentChunk.length > 0 ? '. ' : '') + trimmed;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

/**
 * Check if Pinecone is properly configured
 */
export const isPineconeConfigured = (): boolean => {
  return !!(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);
};

/**
 * Initialize Pinecone index if it doesn't exist
 * Note: This is a one-time setup operation
 */
export const initializePineconeIndex = async (): Promise<void> => {
  if (!isPineconeConfigured()) {
    throw new Error('Pinecone not configured');
  }

  const pinecone = getPineconeClient();

  // Check if index exists
  const indexes = await pinecone.listIndexes();
  const indexExists = indexes.indexes?.some(idx => idx.name === PINECONE_INDEX_NAME);

  if (!indexExists) {
    // Create index with 1536 dimensions (text-embedding-3-small)
    await pinecone.createIndex({
      name: PINECONE_INDEX_NAME,
      dimension: 1536,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });

    console.log(`✅ Created Pinecone index: ${PINECONE_INDEX_NAME}`);
  } else {
    console.log(`✅ Pinecone index already exists: ${PINECONE_INDEX_NAME}`);
  }
};
