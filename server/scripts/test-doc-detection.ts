import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

import { isDocumentQuestion } from '../src/aiAgent';

async function testDocDetection() {
  console.log('🧪 Testing Document Question Detection\n');

  const testCases = [
    {
      message: "What is the NDA policy?",
      expected: true,
      reason: "Clear document question"
    },
    {
      message: "I am actually wondering what i need to know about our NDA?",
      expected: true,
      reason: "Document question with 'wondering what' pattern"
    },
    {
      message: "I need an NDA for a vendor",
      expected: false,
      reason: "Requesting legal help"
    },
    {
      message: "Tell me about data retention requirements",
      expected: true,
      reason: "Policy question with 'tell me about' pattern"
    },
    {
      message: "Help me draft a contract",
      expected: false,
      reason: "Legal request"
    },
    {
      message: "Hello",
      expected: false,
      reason: "Greeting - not a document question"
    },
    {
      message: "I just need to send a document to marketing",
      expected: false,
      reason: "Request for help, not asking about policy"
    },
    {
      message: "What is our IP policy?",
      expected: true,
      reason: "Question about policy"
    }
  ];

  for (const testCase of testCases) {
    const messages = [{ role: 'user' as const, content: testCase.message }];
    const result = await isDocumentQuestion(messages);

    const status = result === testCase.expected ? '✅' : '❌';
    console.log(`${status} "${testCase.message}"`);
    console.log(`   Expected: ${testCase.expected ? 'DOC' : 'REQUEST'}, Got: ${result ? 'DOC' : 'REQUEST'}`);
    console.log(`   Reason: ${testCase.reason}\n`);
  }
}

testDocDetection().catch(console.error);
