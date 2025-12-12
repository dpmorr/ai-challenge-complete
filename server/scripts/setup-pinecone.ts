/**
 * Setup Pinecone index for vector embeddings
 * Run with: npx tsx scripts/setup-pinecone.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { Pinecone } from '@pinecone-database/pinecone';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || 'acme-legal-docs';
const EMBEDDING_DIMENSION = 1536; // OpenAI text-embedding-3-small

async function setupPinecone() {
  if (!process.env.PINECONE_API_KEY) {
    console.error('❌ PINECONE_API_KEY is not set in .env');
    process.exit(1);
  }

  console.log('🌲 Setting up Pinecone...\n');
  console.log(`API Key: ${process.env.PINECONE_API_KEY.substring(0, 10)}...`);
  console.log(`Index Name: ${PINECONE_INDEX_NAME}`);
  console.log(`Embedding Dimension: ${EMBEDDING_DIMENSION}\n`);

  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });

    // List existing indexes
    console.log('📋 Checking existing indexes...');
    const indexes = await pinecone.listIndexes();
    console.log('Existing indexes:', indexes.indexes?.map(i => i.name) || []);

    const indexExists = indexes.indexes?.some(i => i.name === PINECONE_INDEX_NAME);

    if (indexExists) {
      console.log(`\n✅ Index "${PINECONE_INDEX_NAME}" already exists!`);

      // Get index stats
      const index = pinecone.Index(PINECONE_INDEX_NAME);
      const stats = await index.describeIndexStats();
      console.log('\n📊 Index Stats:');
      console.log(`  - Total vectors: ${stats.totalRecordCount || 0}`);
      console.log(`  - Dimension: ${stats.dimension || 'unknown'}`);
      console.log(`  - Namespaces: ${Object.keys(stats.namespaces || {}).length}`);
    } else {
      console.log(`\n📝 Creating new index "${PINECONE_INDEX_NAME}"...`);

      await pinecone.createIndex({
        name: PINECONE_INDEX_NAME,
        dimension: EMBEDDING_DIMENSION,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });

      console.log('✅ Index created successfully!');
      console.log('\n⏳ Waiting for index to be ready...');

      // Wait for index to be ready
      let ready = false;
      let attempts = 0;
      while (!ready && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const indexList = await pinecone.listIndexes();
        const indexInfo = indexList.indexes?.find(i => i.name === PINECONE_INDEX_NAME);
        ready = indexInfo?.status?.ready === true;
        attempts++;
        process.stdout.write('.');
      }

      if (ready) {
        console.log('\n✅ Index is ready!');
      } else {
        console.log('\n⚠️  Index is being initialized. It may take a few minutes.');
      }
    }

    console.log('\n🎉 Pinecone setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npx tsx scripts/seed-documents.ts');
    console.log('2. This will chunk documents and generate embeddings');
    console.log('3. Test semantic search in the chat interface');

  } catch (error: any) {
    console.error('\n❌ Error setting up Pinecone:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

setupPinecone();
