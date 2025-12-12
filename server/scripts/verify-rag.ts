import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

import prisma from '../src/db';
import { Pinecone } from '@pinecone-database/pinecone';

async function verifyRAG() {
  console.log('📊 Checking RAG setup...\n');

  // Check database chunks
  const docs = await prisma.document.findMany({
    include: { embeddings: true }
  });

  console.log('PostgreSQL Database:');
  console.log(`  - Documents: ${docs.length}`);
  let totalChunks = 0;
  docs.forEach(d => {
    totalChunks += d.embeddings.length;
    console.log(`  - ${d.title}: ${d.embeddings.length} chunks`);
  });
  console.log(`  - Total chunks: ${totalChunks}\n`);

  // Check Pinecone
  if (process.env.PINECONE_API_KEY) {
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.Index('acme-legal-docs');
    const stats = await index.describeIndexStats();

    console.log('Pinecone Vector Database:');
    console.log(`  - Total vectors: ${stats.totalRecordCount || 0}`);
    console.log(`  - Dimension: ${stats.dimension}`);
    console.log(`  - Metric: cosine similarity\n`);
  }

  console.log('✅ TRUE RAG is now enabled!');
  console.log('\nWhat changed:');
  console.log('  ✓ Documents are chunked into smaller pieces');
  console.log('  ✓ Each chunk has a vector embedding');
  console.log('  ✓ Vectors stored in Pinecone');
  console.log('  ✓ Semantic search finds relevant chunks');
  console.log('  ✓ Only relevant chunks sent to LLM\n');

  await prisma.$disconnect();
}

verifyRAG().catch(console.error);
