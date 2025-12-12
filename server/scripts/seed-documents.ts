/**
 * Seed script to add sample legal documents to the database
 * Run with: npx tsx scripts/seed-documents.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Set DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/acme_legal_triage?schema=public';
  console.log('⚙️  Using default DATABASE_URL');
}

import { addDocument } from '../src/documentRAG';

const sampleDocuments = [
  {
    title: 'NDA Policy and Templates',
    category: 'NDA',
    content: `# Non-Disclosure Agreement (NDA) Policy

## Overview
Acme Corp requires NDAs for all vendor relationships, partnerships, and sensitive business discussions.

## When to Use an NDA
- New vendor onboarding
- Partnership discussions
- Technology sharing
- Merger and acquisition talks
- Contractor engagements

## Types of NDAs
1. **Unilateral NDA**: One party discloses information
2. **Mutual NDA**: Both parties share confidential information
3. **Multilateral NDA**: Three or more parties involved

## Standard Terms
- Confidentiality period: 3-5 years
- Permitted disclosures: Legal requirements only
- Return of information: Within 30 days of termination
- Governing law: Delaware

## Process
1. Request NDA from legal team
2. Legal reviews and customizes template
3. Both parties sign
4. Executed copy filed with legal department

## Templates Available
- Standard Vendor NDA
- Partner Mutual NDA
- Employee NDA
- Consultant Agreement with NDA provisions`,
    tags: ['NDA', 'templates', 'policy', 'vendors']
  },
  {
    title: 'Contract Review Guidelines',
    category: 'Contracts',
    content: `# Contract Review Guidelines

## Purpose
This guide helps employees understand when and how to engage legal for contract reviews.

## When Legal Review is Required
- Contracts over $50,000
- Multi-year commitments
- Data processing agreements
- International agreements
- IP licensing
- Employment contracts for executives

## Self-Service Contracts (Under $10,000)
For low-value, standard contracts:
1. Use pre-approved templates
2. Fill in specific terms
3. No legal review needed
4. File copy with procurement

## Review Turnaround Times
- Standard review: 5 business days
- Expedited review: 2 business days (requires VP approval)
- Complex/international: 10+ business days

## Key Terms to Watch
- Indemnification clauses
- Liability caps
- Force majeure
- Termination rights
- Automatic renewal
- Governing law and jurisdiction

## Regional Considerations
### Australia
- Consumer law compliance required
- ACCC guidelines apply
- Local counsel for large deals

### United States
- State-specific regulations
- Tax implications
- Securities law (for partnerships)

### United Kingdom
- GDPR compliance
- Brexit-related terms
- Local employment law`,
    tags: ['contracts', 'guidelines', 'process', 'review']
  },
  {
    title: 'Employment Law Compliance',
    category: 'Employment',
    content: `# Employment Law Compliance Guide

## Overview
Acme Corp operates in multiple jurisdictions with varying employment laws.

## Hiring Requirements

### Background Checks
- All countries: Criminal background check
- United States: Credit check for financial roles
- Australia: Working with Children check (if applicable)

### Employment Contracts
All employees must have written contracts including:
- Job title and description
- Compensation and benefits
- Working hours
- Leave entitlements
- Termination provisions
- Confidentiality and IP assignment

## Leave Policies

### United States
- No statutory leave (company provides 15 days PTO)
- FMLA for eligible employees
- State-specific sick leave

### Australia
- 4 weeks annual leave
- 10 days personal/carer's leave
- Long service leave after 7 years

### United Kingdom
- 28 days statutory leave
- Sick leave: SSP after 4 days
- Maternity/paternity leave

## Termination

### Notice Periods
- US: At-will employment (no notice required by law)
- Australia: 1-4 weeks based on tenure
- UK: Statutory minimum based on service length

### Severance
- US: Discretionary
- Australia: Redundancy pay if applicable
- UK: Statutory redundancy after 2 years

## Workplace Issues

### Discrimination and Harassment
Zero tolerance policy. Report to HR immediately.

### Remote Work
- Equipment provided by company
- Ergonomic assessment required
- Data security protocols

## Compliance Contacts
- US Employment Law: sarah.chen@acme.corp
- AU Employment Law: lisa.thompson@acme.corp
- UK Employment Law: emily.watson@acme.corp`,
    tags: ['employment', 'HR', 'compliance', 'hiring']
  },
  {
    title: 'Data Privacy and GDPR Compliance',
    category: 'Privacy',
    content: `# Data Privacy Policy

## Scope
Applies to all personal data processed by Acme Corp globally.

## Legal Bases for Processing
1. **Consent**: Marketing communications
2. **Contract**: Customer and employee data
3. **Legal obligation**: Tax, employment records
4. **Legitimate interest**: Business operations

## Data Subject Rights

### GDPR (EU/UK)
- Right to access
- Right to rectification
- Right to erasure ("right to be forgotten")
- Right to data portability
- Right to object
- Rights related to automated decision-making

### CCPA (California)
- Right to know
- Right to delete
- Right to opt-out of sale
- Right to non-discrimination

### Australian Privacy Act
- Access and correction rights
- Notification of data breaches

## Data Retention

### Customer Data
- Active customers: Duration of relationship
- Inactive customers: 7 years after last activity
- Marketing data: Until opt-out

### Employee Data
- Current employees: Duration of employment
- Former employees: 7 years post-termination
- Recruitment data: 1 year if not hired

## Data Breaches
1. Contain the breach immediately
2. Notify legal team within 1 hour
3. Document all details
4. Legal determines notification requirements:
   - GDPR: 72 hours to authority
   - CCPA: Without unreasonable delay
   - AU: ASAP if serious harm likely

## Third-Party Processors
- Data Processing Agreements required
- Annual vendor assessments
- Compliance with relevant privacy laws

## Contact
Data Protection Officer: privacy@acme.corp`,
    tags: ['privacy', 'GDPR', 'compliance', 'data protection']
  },
  {
    title: 'Intellectual Property Rights',
    category: 'IP',
    content: `# Intellectual Property Policy

## Employee IP Assignment
All work-related inventions, designs, and creations belong to Acme Corp.

### What's Covered
- Software code
- Product designs
- Business processes
- Marketing materials
- Trade secrets
- Inventions

### Employee Inventions
California employees: Pre-invention assignment may not cover:
- Inventions created entirely on own time
- Without company equipment
- Not related to company business
- Not resulting from company work

## Open Source Software

### Allowed Licenses
- MIT
- Apache 2.0
- BSD
- ISC

### Restricted Licenses (Require Legal Approval)
- GPL (any version)
- AGPL
- LGPL
- Creative Commons SA

### Process
1. Developer proposes OSS use
2. Legal reviews license
3. Approval granted or alternative suggested
4. Usage logged in inventory

## Patents

### Filing Process
1. Inventor discloses invention to legal
2. Patentability assessment (2 weeks)
3. If approved, provisional filed (1 month)
4. Non-provisional within 12 months

### Inventor Rights
- Named on patent
- Recognition bonus
- Licensing royalties (if applicable)

## Trademarks

### Acme Corp Marks
- "Acme Corp" (word mark)
- Acme logo (design mark)
- Product names: [registered in key markets]

### Using Marks
- Always include ® or ™
- Don't modify or change
- Follow brand guidelines
- Report infringement to legal

## Copyright

### Work for Hire
All employee-created works are company property.

### Third-Party Content
- Obtain licenses before use
- Attribute properly
- Respect fair use limits

## Trade Secrets

### Definition
Confidential business information providing competitive advantage:
- Customer lists
- Pricing strategies
- Product roadmaps
- Source code
- Manufacturing processes

### Protection
- Mark as "Confidential"
- Limit access
- Non-disclosure agreements
- Secure storage`,
    tags: ['IP', 'patents', 'trademarks', 'copyright', 'trade secrets']
  }
];

async function seedDocuments() {
  console.log('📚 Seeding sample legal documents...\n');

  for (const doc of sampleDocuments) {
    try {
      console.log(`Adding: ${doc.title}...`);
      const documentId = await addDocument(doc);
      console.log(`✅ Added ${doc.title} (ID: ${documentId})\n`);
    } catch (error) {
      console.error(`❌ Error adding ${doc.title}:`, error);
    }
  }

  console.log('\n🎉 Document seeding complete!');
  console.log('\nYou can now ask questions like:');
  console.log('- "What is the NDA policy?"');
  console.log('- "How do I get a contract reviewed?"');
  console.log('- "What are the data retention requirements?"');
  console.log('- "Tell me about employee IP rights"');
}

seedDocuments()
  .catch(console.error)
  .finally(() => process.exit(0));
