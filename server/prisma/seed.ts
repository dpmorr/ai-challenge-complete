import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.conversationMsg.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.lawyerSkill.deleteMany();
  await prisma.lawyer.deleteMany();
  await prisma.legalTerm.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.condition.deleteMany();
  await prisma.triageRule.deleteMany();

  // Seed Triage Rules (migrated from in-memory storage)
  console.log('📋 Creating triage rules...');

  const rule1 = await prisma.triageRule.create({
    data: {
      name: 'Sales Contracts - Australia',
      assignee: 'john@acme.corp',
      priority: 1,
      enabled: true,
      conditions: {
        create: [
          { field: 'requestType', operator: 'equals', value: 'Sales Contract' },
          { field: 'location', operator: 'equals', value: 'Australia' }
        ]
      }
    }
  });

  const rule2 = await prisma.triageRule.create({
    data: {
      name: 'Sales Contracts - United States',
      assignee: 'jane@acme.corp',
      priority: 2,
      enabled: true,
      conditions: {
        create: [
          { field: 'requestType', operator: 'equals', value: 'Sales Contract' },
          { field: 'location', operator: 'equals', value: 'United States' }
        ]
      }
    }
  });

  const rule3 = await prisma.triageRule.create({
    data: {
      name: 'Employment Contracts - United States',
      assignee: 'abc@acme.corp',
      priority: 3,
      enabled: true,
      conditions: {
        create: [
          { field: 'requestType', operator: 'equals', value: 'Employment Contract' },
          { field: 'location', operator: 'equals', value: 'United States' }
        ]
      }
    }
  });

  const rule4 = await prisma.triageRule.create({
    data: {
      name: 'Employment Contracts - Australia',
      assignee: 'employment-au@acme.corp',
      priority: 4,
      enabled: true,
      conditions: {
        create: [
          { field: 'requestType', operator: 'equals', value: 'Employment Contract' },
          { field: 'location', operator: 'equals', value: 'Australia' }
        ]
      }
    }
  });

  const rule5 = await prisma.triageRule.create({
    data: {
      name: 'Marketing Review',
      assignee: 'marketing-legal@acme.corp',
      priority: 5,
      enabled: true,
      conditions: {
        create: [
          { field: 'requestType', operator: 'equals', value: 'Marketing Review' }
        ]
      }
    }
  });

  console.log(`✅ Created ${5} triage rules`);

  // Seed Legal Terms for fuzzy matching
  console.log('📚 Creating legal terminology library...');

  const legalTerms = [
    {
      term: 'Sales Contract',
      category: 'request_type',
      synonyms: ['sales agreement', 'purchase agreement', 'sales contract', 'vendor agreement', 'sales deal']
    },
    {
      term: 'Employment Contract',
      category: 'request_type',
      synonyms: ['employment agreement', 'job contract', 'job offer', 'employment terms', 'work agreement', 'hire contract']
    },
    {
      term: 'NDA',
      category: 'request_type',
      synonyms: ['non-disclosure agreement', 'nda', 'confidentiality agreement', 'secrecy agreement']
    },
    {
      term: 'Marketing Review',
      category: 'request_type',
      synonyms: ['marketing approval', 'advertising review', 'campaign review', 'marketing legal', 'promo review']
    },
    {
      term: 'General Question',
      category: 'request_type',
      synonyms: ['general inquiry', 'question', 'help', 'general', 'legal question']
    },
    {
      term: 'United States',
      category: 'location',
      synonyms: ['us', 'usa', 'united states', 'america', 'u.s.', 'u.s.a']
    },
    {
      term: 'Australia',
      category: 'location',
      synonyms: ['au', 'aus', 'australia', 'aussie']
    },
    {
      term: 'United Kingdom',
      category: 'location',
      synonyms: ['uk', 'united kingdom', 'britain', 'great britain', 'england', 'u.k.']
    },
    {
      term: 'Engineering',
      category: 'department',
      synonyms: ['engineering', 'eng', 'development', 'dev', 'tech', 'technical']
    },
    {
      term: 'Sales',
      category: 'department',
      synonyms: ['sales', 'business development', 'bd', 'account management']
    },
    {
      term: 'Marketing',
      category: 'department',
      synonyms: ['marketing', 'mktg', 'advertising', 'comms', 'communications']
    }
  ];

  for (const term of legalTerms) {
    await prisma.legalTerm.create({ data: term });
  }

  console.log(`✅ Created ${legalTerms.length} legal terms`);

  // Seed Employees
  console.log('👥 Creating employee profiles...');

  const employees = [
    {
      email: 'alice.smith@acme.corp',
      firstName: 'Alice',
      lastName: 'Smith',
      department: 'Engineering',
      location: 'United States',
      role: 'Senior Engineer'
    },
    {
      email: 'bob.jones@acme.corp',
      firstName: 'Bob',
      lastName: 'Jones',
      department: 'Sales',
      location: 'Australia',
      role: 'Sales Manager'
    },
    {
      email: 'charlie.brown@acme.corp',
      firstName: 'Charlie',
      lastName: 'Brown',
      department: 'Marketing',
      location: 'United Kingdom',
      role: 'Marketing Director'
    }
  ];

  for (const employee of employees) {
    await prisma.employee.create({ data: employee });
  }

  console.log(`✅ Created ${employees.length} employees`);

  // Seed Lawyers
  console.log('⚖️  Creating lawyer profiles...');

  const john = await prisma.lawyer.create({
    data: {
      email: 'john@acme.corp',
      firstName: 'John',
      lastName: 'Anderson',
      maxCaseLoad: 10,
      currentLoad: 3,
      available: true,
      specialties: {
        create: [
          { skillType: 'Sales Contract', proficiency: 5 },
          { skillType: 'Commercial Law', proficiency: 5 },
          { skillType: 'International Trade', proficiency: 4 }
        ]
      }
    }
  });

  const jane = await prisma.lawyer.create({
    data: {
      email: 'jane@acme.corp',
      firstName: 'Jane',
      lastName: 'Williams',
      maxCaseLoad: 12,
      currentLoad: 5,
      available: true,
      specialties: {
        create: [
          { skillType: 'Sales Contract', proficiency: 5 },
          { skillType: 'M&A', proficiency: 4 },
          { skillType: 'Corporate Law', proficiency: 5 }
        ]
      }
    }
  });

  const abc = await prisma.lawyer.create({
    data: {
      email: 'abc@acme.corp',
      firstName: 'Anna',
      lastName: 'Chen',
      maxCaseLoad: 8,
      currentLoad: 2,
      available: true,
      specialties: {
        create: [
          { skillType: 'Employment Contract', proficiency: 5 },
          { skillType: 'Labor Law', proficiency: 5 },
          { skillType: 'HR Compliance', proficiency: 4 }
        ]
      }
    }
  });

  const marketingLegal = await prisma.lawyer.create({
    data: {
      email: 'marketing-legal@acme.corp',
      firstName: 'Marketing',
      lastName: 'Legal Team',
      maxCaseLoad: 15,
      currentLoad: 7,
      available: true,
      specialties: {
        create: [
          { skillType: 'Marketing Review', proficiency: 5 },
          { skillType: 'Advertising Law', proficiency: 5 },
          { skillType: 'IP Law', proficiency: 4 }
        ]
      }
    }
  });

  console.log(`✅ Created 4 lawyers with specialties`);

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
