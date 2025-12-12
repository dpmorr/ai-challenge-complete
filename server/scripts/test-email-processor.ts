/**
 * Test script for email automation
 * Run with: npx tsx scripts/test-email-processor.ts
 */

// Load environment variables from parent directory
import dotenv from 'dotenv';
import path from 'path';

// Try to load .env from parent directory first, then local
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Set DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/acme_legal_triage?schema=public';
  console.log('⚙️  Using default DATABASE_URL');
}

import { processIncomingEmail, IncomingEmail } from '../src/emailProcessor';

// Test emails for different scenarios
const testEmails: IncomingEmail[] = [
  {
    from: 'wei.zhang@acme.corp',
    to: 'legal@acme.corp',
    subject: 'Need NDA for new vendor',
    body: `Hi Legal Team,

I'm working with a new vendor and they need an NDA signed before we can proceed.

Can someone help me get this sorted?

Thanks,
Wei`,
    timestamp: new Date()
  },
  {
    from: 'ceo@acme.corp',
    to: 'legal@acme.corp',
    subject: 'Urgent: Employment contract review',
    body: `I need someone to review an executive employment contract ASAP. This is for a VP-level hire.

Thanks,
Jennifer`,
    timestamp: new Date()
  },
  {
    from: 'sales.au@acme.corp',
    to: 'legal@acme.corp',
    subject: 'Sales contract question',
    body: `Hey team,

I have a question about a sales contract with a client in Sydney. Can someone assist?

Emma`,
    timestamp: new Date()
  },
  {
    from: 'unknown@external.com',
    to: 'legal@acme.corp',
    subject: 'Legal inquiry',
    body: 'I have a legal question about your company.',
    timestamp: new Date()
  }
];

async function main() {
  console.log('🧪 Testing Email Processor\n');

  for (let i = 0; i < testEmails.length; i++) {
    const email = testEmails[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Test ${i + 1}/${testEmails.length}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`From: ${email.from}`);
    console.log(`Subject: ${email.subject}`);
    console.log(`Body: ${email.body.substring(0, 100)}...`);
    console.log('-'.repeat(80));

    try {
      const response = await processIncomingEmail(email);

      if (response) {
        console.log('\n✅ Response Generated:');
        console.log(`To: ${response.to}`);
        if (response.cc) console.log(`CC: ${response.cc.join(', ')}`);
        if (response.replyTo) console.log(`Reply-To: ${response.replyTo}`);
        console.log(`Subject: ${response.subject}`);
        console.log('\nBody:');
        console.log(response.body);
      } else {
        console.log('\n⚠️  No response generated');
      }
    } catch (error) {
      console.error('\n❌ Error:', error);
    }

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ All tests complete');
  console.log(`${'='.repeat(80)}\n`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
