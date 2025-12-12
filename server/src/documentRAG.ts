import prisma from './db';
import {
  chunkText,
  generateEmbeddingsBatch,
  storeEmbeddingsBatch,
  semanticSearch,
  deleteEmbeddingsBatch,
  isPineconeConfigured
} from './embeddings';
import OpenAI from 'openai';

const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL
  });
};

const getModel = () => {
  const baseUrl = process.env.OPENAI_BASE_URL || '';
  if (baseUrl.includes('groq.com')) {
    return 'openai/gpt-oss-120b';
  }
  return 'gpt-4o-mini';
};

export interface DocumentInput {
  title: string;
  content: string;
  category: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Add a document to the RAG system with automatic chunking and embedding
 */
export const addDocument = async (input: DocumentInput): Promise<string> => {
  // Create document in database
  const document = await prisma.document.create({
    data: {
      title: input.title,
      content: input.content,
      category: input.category,
      tags: input.tags || [],
      metadata: input.metadata || {}
    }
  });

  // Only process embeddings if Pinecone is configured
  if (isPineconeConfigured()) {
    try {
      // Chunk the content
      const chunks = chunkText(input.content);

      // Generate embeddings for all chunks
      const embeddings = await generateEmbeddingsBatch(chunks);

      // Store chunks in database
      const chunkRecords = await Promise.all(
        chunks.map(async (chunk, index) => {
          const vectorId = `${document.id}_chunk_${index}`;

          return await prisma.documentChunk.create({
            data: {
              documentId: document.id,
              chunkIndex: index,
              content: chunk,
              vectorId,
              tokenCount: embeddings[index].tokenCount
            }
          });
        })
      );

      // Store embeddings in Pinecone
      await storeEmbeddingsBatch(
        chunkRecords.map((chunk, index) => ({
          id: chunk.vectorId!,
          embedding: embeddings[index].embedding,
          metadata: {
            documentId: document.id,
            chunkId: chunk.id,
            chunkIndex: index,
            title: input.title,
            category: input.category,
            content: chunk.content,
            tags: input.tags || []
          }
        }))
      );

      console.log(`✅ Indexed document "${input.title}" with ${chunks.length} chunks`);
    } catch (error) {
      console.error(`Error indexing document: ${error}`);
      // Document is still in DB, but embeddings failed
      // This is okay - document can still be retrieved by full-text search
    }
  }

  return document.id;
};

/**
 * Delete a document and its embeddings
 */
export const deleteDocument = async (documentId: string): Promise<void> => {
  // Get all chunks
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId }
  });

  // Delete from Pinecone
  if (isPineconeConfigured()) {
    const vectorIds = chunks.map(c => c.vectorId).filter(id => id !== null) as string[];
    if (vectorIds.length > 0) {
      await deleteEmbeddingsBatch(vectorIds);
    }
  }

  // Delete from database (cascade will delete chunks)
  await prisma.document.delete({
    where: { id: documentId }
  });

  console.log(`✅ Deleted document ${documentId}`);
};

export interface RelevantChunk {
  documentId: string;
  documentTitle: string;
  chunkContent: string;
  score: number;
  category: string;
}

/**
 * Search for relevant document chunks using semantic search
 */
export const searchDocuments = async (
  query: string,
  category?: string,
  topK: number = 5
): Promise<RelevantChunk[]> => {
  if (!isPineconeConfigured()) {
    // Fallback to database full-text search
    return await fallbackTextSearch(query, category, topK);
  }

  try {
    // Build filter
    const filter: Record<string, any> = {};
    if (category) {
      filter.category = { $eq: category };
    }

    // Perform semantic search
    const results = await semanticSearch(query, topK, Object.keys(filter).length > 0 ? filter : undefined);

    // Map results to relevant chunks
    return results.map(result => ({
      documentId: result.metadata.documentId as string,
      documentTitle: result.metadata.title as string,
      chunkContent: result.metadata.content as string,
      score: result.score,
      category: result.metadata.category as string
    }));
  } catch (error) {
    console.error('Semantic search failed, falling back to text search:', error);
    return await fallbackTextSearch(query, category, topK);
  }
};

/**
 * Fallback full-text search when Pinecone is not available
 */
const fallbackTextSearch = async (
  query: string,
  category?: string,
  topK: number = 5
): Promise<RelevantChunk[]> => {
  // Build where clause with proper typing
  interface DocumentWhereInput {
    category?: string;
    OR?: Array<{
      title?: { contains: string; mode: 'insensitive' };
      content?: { contains: string; mode: 'insensitive' };
      tags?: { has: string };
    }>;
  }

  const where: DocumentWhereInput = {
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { content: { contains: query, mode: 'insensitive' } },
      { tags: { has: query } }
    ]
  };

  if (category) {
    where.category = category;
  }

  // Simple text search using LIKE
  const documents = await prisma.document.findMany({
    where,
    include: {
      embeddings: {
        orderBy: {
          chunkIndex: 'asc'
        },
        take: topK
      }
    },
    take: topK
  });

  // Convert to relevant chunks
  const chunks: RelevantChunk[] = [];

  for (const doc of documents) {
    for (const chunk of doc.embeddings) {
      chunks.push({
        documentId: doc.id,
        documentTitle: doc.title,
        chunkContent: chunk.content,
        score: 0.5, // Arbitrary score for fallback
        category: doc.category
      });
    }
  }

  return chunks.slice(0, topK);
};

/**
 * Generate an AI response using RAG (Retrieval Augmented Generation)
 */
export const generateRAGResponse = async (
  query: string,
  category?: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  employee?: any
): Promise<string> => {
  // Search for relevant documents
  const relevantChunks = await searchDocuments(query, category, 3);

  if (relevantChunks.length === 0) {
    return "I couldn't find any relevant information in our document library. Could you please rephrase your question or contact the legal team directly?";
  }

  // Build context from relevant chunks
  const context = relevantChunks
    .map((chunk, i) => `[Source ${i + 1}: ${chunk.documentTitle}]\n${chunk.chunkContent}`)
    .join('\n\n---\n\n');

  // Extract potential request type from query for lawyer recommendation
  const queryLower = query.toLowerCase();
  let suggestedSpecialty = '';

  if (queryLower.includes('employment') || queryLower.includes('contract') && (queryLower.includes('hire') || queryLower.includes('employee'))) {
    suggestedSpecialty = 'Employment Contract';
  } else if (queryLower.includes('nda') || queryLower.includes('non-disclosure')) {
    suggestedSpecialty = 'NDA';
  } else if (queryLower.includes('sales') || queryLower.includes('vendor') || queryLower.includes('customer contract')) {
    suggestedSpecialty = 'Sales Contract';
  } else if (queryLower.includes('marketing') || queryLower.includes('ip') || queryLower.includes('intellectual property') || queryLower.includes('trademark') || queryLower.includes('patent')) {
    suggestedSpecialty = 'Marketing Review';
  } else if (queryLower.includes('contract')) {
    suggestedSpecialty = 'Contract Review';
  } else {
    suggestedSpecialty = 'General Legal';
  }

  // Build employee context for better recommendations
  let employeeContext = '';
  if (employee) {
    employeeContext = `\n\nEMPLOYEE CONTEXT:
- Department: ${employee.department || 'Unknown'}
- Location: ${employee.location || 'Unknown'}
- Role: ${employee.role || 'Unknown'}`;
  }

  // Build system prompt with context
  const systemPrompt = `You are a helpful legal assistant for Acme Corp. Use the following context from our legal document library to answer the user's question. If the context doesn't contain relevant information, say so clearly.

CONTEXT:
${context}${employeeContext}

INSTRUCTIONS:
- Answer based on the context provided
- Be precise and cite which source you're using (e.g., "According to [Source 1]...")
- If the context doesn't fully answer the question, acknowledge what you can and can't answer
- IMPORTANT: Always end your response with a recommendation for who to talk to for further help
- The recommendation should suggest the appropriate legal specialist based on the topic (e.g., "For specific advice on employment contracts, I recommend speaking with Sarah Chen (sarah.chen@acme.corp) who specializes in Employment Law")
- Make the recommendation conversational and natural, not a separate section
- Infer the best legal specialty from the question context: ${suggestedSpecialty}`;

  // Build messages
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt }
  ];

  // Add conversation history if provided
  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory);
  }

  // Add current query
  messages.push({
    role: 'user',
    content: query
  });

  // Generate response
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: getModel(),
    messages: messages as any,
    temperature: 0.7,
    max_tokens: 600
  });

  return response.choices[0]?.message?.content?.trim() ||
    "I apologize, but I encountered an error generating a response.";
};

/**
 * Get all documents (for admin interface)
 */
export const getAllDocuments = async (category?: string) => {
  interface DocumentFilterInput {
    category?: string;
  }

  const where: DocumentFilterInput = {};
  if (category) {
    where.category = category;
  }

  return await prisma.document.findMany({
    where,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      _count: {
        select: {
          embeddings: true
        }
      }
    }
  });
};

/**
 * Get a specific document by ID
 */
export const getDocument = async (documentId: string) => {
  return await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      embeddings: {
        orderBy: {
          chunkIndex: 'asc'
        }
      }
    }
  });
};

/**
 * Update a document (re-generates embeddings)
 */
export const updateDocument = async (
  documentId: string,
  updates: Partial<DocumentInput>
): Promise<void> => {
  const document = await prisma.document.findUnique({
    where: { id: documentId }
  });

  if (!document) {
    throw new Error('Document not found');
  }

  // If content changed, re-generate embeddings
  if (updates.content && updates.content !== document.content) {
    // Delete old embeddings
    const oldChunks = await prisma.documentChunk.findMany({
      where: { documentId }
    });

    if (isPineconeConfigured()) {
      const vectorIds = oldChunks.map(c => c.vectorId).filter(id => id !== null) as string[];
      if (vectorIds.length > 0) {
        await deleteEmbeddingsBatch(vectorIds);
      }
    }

    await prisma.documentChunk.deleteMany({
      where: { documentId }
    });

    // Create new embeddings (same logic as addDocument)
    if (isPineconeConfigured()) {
      const chunks = chunkText(updates.content);
      const embeddings = await generateEmbeddingsBatch(chunks);

      const chunkRecords = await Promise.all(
        chunks.map(async (chunk, index) => {
          const vectorId = `${documentId}_chunk_${index}`;

          return await prisma.documentChunk.create({
            data: {
              documentId,
              chunkIndex: index,
              content: chunk,
              vectorId,
              tokenCount: embeddings[index].tokenCount
            }
          });
        })
      );

      await storeEmbeddingsBatch(
        chunkRecords.map((chunk, index) => ({
          id: chunk.vectorId!,
          embedding: embeddings[index].embedding,
          metadata: {
            documentId,
            chunkId: chunk.id,
            chunkIndex: index,
            title: updates.title || document.title,
            category: updates.category || document.category,
            content: chunk.content,
            tags: updates.tags || document.tags
          }
        }))
      );
    }
  }

  // Update document
  await prisma.document.update({
    where: { id: documentId },
    data: {
      ...(updates.title && { title: updates.title }),
      ...(updates.content && { content: updates.content }),
      ...(updates.category && { category: updates.category }),
      ...(updates.tags && { tags: updates.tags }),
      ...(updates.metadata && { metadata: updates.metadata })
    }
  });

  console.log(`✅ Updated document ${documentId}`);
};
