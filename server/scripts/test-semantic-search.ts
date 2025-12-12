import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

import { searchDocuments } from '../src/documentRAG';

async function testSemanticSearch() {
  console.log('🔍 Testing Semantic Search with Pinecone\n');

  const testQueries = [
    'What is the NDA policy?',
    'How do I protect confidential information?',
    'Tell me about data retention requirements',
    'What are employee invention rights?'
  ];

  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log('─'.repeat(60));

    const results = await searchDocuments(query, undefined, 3);

    if (results.length === 0) {
      console.log('  ❌ No results found');
    } else {
      results.forEach((result, i) => {
        console.log(`\n  [${i + 1}] ${result.documentTitle} (${result.category})`);
        console.log(`      Score: ${result.score.toFixed(4)}`);
        console.log(`      Preview: ${result.chunkContent.substring(0, 100)}...`);
      });
    }
  }

  console.log('\n\n✅ Semantic search test complete!');
  console.log('\nNotice how:');
  console.log('  - Queries find semantically related content');
  console.log('  - Not just keyword matching');
  console.log('  - Relevance scores show best matches first');
}

testSemanticSearch().catch(console.error);
