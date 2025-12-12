import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding test data...');

  // Clear existing data (optional - comment out if you want to keep existing data)
  console.log('Clearing existing data...');
  await prisma.conversation.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.lawyer.deleteMany();

  // ============================================================================
  // LAWYERS - Various specialties, locations, and availability
  // ============================================================================

  console.log('Creating lawyers...');

  const lawyers = await Promise.all([
    // Employment law specialists
    prisma.lawyer.create({
      data: {
        name: 'Sarah Chen',
        email: 'sarah.chen@acme.corp',
        specialties: ['Employment Contract', 'HR Policies', 'Workplace Disputes'],
        locations: ['United States', 'Canada'],
        departments: ['Engineering', 'HR', 'Sales'],
        tags: ['VIP', 'Executive'],
        calendarAvailability: {
          timezone: 'America/New_York',
          workingHours: {
            monday: { start: '09:00', end: '17:00', available: true },
            tuesday: { start: '09:00', end: '17:00', available: true },
            wednesday: { start: '09:00', end: '17:00', available: true },
            thursday: { start: '09:00', end: '17:00', available: true },
            friday: { start: '09:00', end: '15:00', available: true }
          },
          upcomingAvailability: [
            { date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], slots: ['10:00', '14:00', '15:30'] },
            { date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], slots: ['09:00', '11:00', '16:00'] },
            { date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], slots: ['10:30', '13:00', '15:00'] }
          ],
          lastSynced: new Date().toISOString(),
          source: 'calendly'
        }
      }
    }),

    prisma.lawyer.create({
      data: {
        name: 'Michael Rodriguez',
        email: 'michael.rodriguez@acme.corp',
        specialties: ['Employment Contract', 'Labor Law'],
        locations: ['Australia', 'New Zealand'],
        departments: ['Engineering', 'Sales', 'Marketing'],
        tags: ['Remote'],
        calendarAvailability: {
          timezone: 'Australia/Sydney',
          workingHours: {
            monday: { start: '08:00', end: '16:00', available: true },
            tuesday: { start: '08:00', end: '16:00', available: true },
            wednesday: { start: '08:00', end: '16:00', available: true },
            thursday: { start: '08:00', end: '16:00', available: true },
            friday: { start: '08:00', end: '14:00', available: true }
          },
          upcomingAvailability: [
            { date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], slots: ['08:00', '10:00', '13:00', '15:00'] },
            { date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], slots: ['08:30', '11:30', '14:30'] }
          ],
          lastSynced: new Date().toISOString(),
          source: 'calendly'
        }
      }
    }),

    // Sales contract specialists
    prisma.lawyer.create({
      data: {
        name: 'Emily Watson',
        email: 'emily.watson@acme.corp',
        specialties: ['Sales Contract', 'Commercial Law', 'NDA'],
        locations: ['United States', 'United Kingdom'],
        departments: ['Sales', 'Marketing', 'Finance'],
        tags: ['VIP'],
        calendarAvailability: {
          timezone: 'America/Los_Angeles',
          upcomingAvailability: [
            { date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], slots: ['09:00', '13:00'] },
            { date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], slots: ['10:00', '14:00'] }
          ],
          lastSynced: new Date().toISOString(),
          source: 'calendly'
        }
      }
    }),

    prisma.lawyer.create({
      data: {
        name: 'David Kim',
        email: 'david.kim@acme.corp',
        specialties: ['Sales Contract', 'Partnership Agreements'],
        locations: ['Australia', 'Singapore'],
        departments: ['Sales', 'Business Development'],
        tags: [],
        calendarAvailability: {
          timezone: 'Asia/Singapore',
          upcomingAvailability: [
            { date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], slots: ['09:00', '11:00', '14:00', '16:00'] },
            { date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], slots: ['10:00', '15:00'] }
          ],
          lastSynced: new Date().toISOString(),
          source: 'calendly'
        }
      }
    }),

    // Marketing & IP specialists
    prisma.lawyer.create({
      data: {
        name: 'Lisa Thompson',
        email: 'lisa.thompson@acme.corp',
        specialties: ['Marketing Review', 'Intellectual Property', 'NDA'],
        locations: ['United States', 'Canada', 'United Kingdom'],
        departments: ['Marketing', 'Product', 'Engineering'],
        tags: ['Executive'],
        calendarAvailability: {
          timezone: 'America/New_York',
          upcomingAvailability: [
            { date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], slots: ['11:00', '14:00', '16:00'] }
          ],
          lastSynced: new Date().toISOString(),
          source: 'calendly'
        }
      }
    }),

    // Generalist (busy - no availability)
    prisma.lawyer.create({
      data: {
        name: 'Robert Brown',
        email: 'robert.brown@acme.corp',
        specialties: ['General Legal', 'Compliance', 'Contract Review'],
        locations: ['United States'],
        departments: ['Legal', 'Finance', 'HR'],
        tags: [],
        calendarAvailability: {
          timezone: 'America/Chicago',
          upcomingAvailability: [], // No availability - busy!
          lastSynced: new Date().toISOString(),
          source: 'calendly'
        }
      }
    })
  ]);

  console.log(`✅ Created ${lawyers.length} lawyers`);

  // ============================================================================
  // EMPLOYEES - Diverse set with different tags, locations, departments
  // ============================================================================

  console.log('Creating employees...');

  const employees = await Promise.all([
    // LEGAL TEAM (Lawyers are also employees!)
    prisma.employee.create({
      data: {
        email: 'sarah.chen@acme.corp',
        firstName: 'Sarah',
        lastName: 'Chen',
        department: 'Legal',
        location: 'United States',
        role: 'Lawyer - Employment Law',
        tags: ['VIP', 'Legal-Team', 'Executive']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'emily.watson@acme.corp',
        firstName: 'Emily',
        lastName: 'Watson',
        department: 'Legal',
        location: 'United States',
        role: 'Lawyer - Commercial Law',
        tags: ['VIP', 'Legal-Team']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'michael.rodriguez@acme.corp',
        firstName: 'Michael',
        lastName: 'Rodriguez',
        department: 'Legal',
        location: 'Australia',
        role: 'Lawyer - Labor Law',
        tags: ['Legal-Team', 'Remote']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'david.kim@acme.corp',
        firstName: 'David',
        lastName: 'Kim',
        department: 'Legal',
        location: 'Singapore',
        role: 'Lawyer - Partnership Agreements',
        tags: ['Legal-Team', 'APAC-Team']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'lisa.thompson@acme.corp',
        firstName: 'Lisa',
        lastName: 'Thompson',
        department: 'Legal',
        location: 'United States',
        role: 'Lawyer - IP & Marketing',
        tags: ['Legal-Team', 'Executive']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'robert.brown@acme.corp',
        firstName: 'Robert',
        lastName: 'Brown',
        department: 'Legal',
        location: 'United States',
        role: 'General Counsel',
        tags: ['Legal-Team', 'VIP', 'Executive']
      }
    }),

    // VIP Executives (Non-Legal)
    prisma.employee.create({
      data: {
        email: 'ceo@acme.corp',
        firstName: 'Jennifer',
        lastName: 'Martinez',
        department: 'Executive',
        location: 'United States',
        role: 'CEO',
        tags: ['VIP', 'Executive', 'Board']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'cto@acme.corp',
        firstName: 'Alex',
        lastName: 'Johnson',
        department: 'Engineering',
        location: 'United States',
        role: 'CTO',
        tags: ['VIP', 'Executive', 'Technical']
      }
    }),

    // Sales team - various locations
    prisma.employee.create({
      data: {
        email: 'sales.us@acme.corp',
        firstName: 'Tom',
        lastName: 'Williams',
        department: 'Sales',
        location: 'United States',
        role: 'Sales Manager',
        tags: ['Manager', 'US-Sales']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'sales.au@acme.corp',
        firstName: 'Emma',
        lastName: 'Smith',
        department: 'Sales',
        location: 'Australia',
        role: 'Sales Representative',
        tags: ['APAC-Sales', 'Remote']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'sales.uk@acme.corp',
        firstName: 'James',
        lastName: 'Taylor',
        department: 'Sales',
        location: 'United Kingdom',
        role: 'Sales Director',
        tags: ['Manager', 'VIP', 'EMEA-Sales']
      }
    }),

    // Engineering team
    prisma.employee.create({
      data: {
        email: 'eng.senior@acme.corp',
        firstName: 'Priya',
        lastName: 'Patel',
        department: 'Engineering',
        location: 'Canada',
        role: 'Senior Engineer',
        tags: ['Technical', 'Remote']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'eng.junior@acme.corp',
        firstName: 'Chris',
        lastName: 'Anderson',
        department: 'Engineering',
        location: 'United States',
        role: 'Software Engineer',
        tags: ['New-Hire']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'eng.au@acme.corp',
        firstName: 'Wei',
        lastName: 'Zhang',
        department: 'Engineering',
        location: 'Australia',
        role: 'Engineering Manager',
        tags: ['Manager', 'APAC-Team', 'Remote']
      }
    }),

    // Marketing team
    prisma.employee.create({
      data: {
        email: 'marketing.head@acme.corp',
        firstName: 'Sophie',
        lastName: 'Davis',
        department: 'Marketing',
        location: 'United States',
        role: 'VP Marketing',
        tags: ['VIP', 'Executive', 'Marketing-Lead']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'marketing.content@acme.corp',
        firstName: 'Ryan',
        lastName: 'Miller',
        department: 'Marketing',
        location: 'United Kingdom',
        role: 'Content Manager',
        tags: ['Marketing-Team', 'Remote']
      }
    }),

    // HR team
    prisma.employee.create({
      data: {
        email: 'hr.director@acme.corp',
        firstName: 'Maria',
        lastName: 'Garcia',
        department: 'HR',
        location: 'United States',
        role: 'HR Director',
        tags: ['Manager', 'HR-Lead']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'hr.recruiter@acme.corp',
        firstName: 'Kevin',
        lastName: 'Lee',
        department: 'HR',
        location: 'Canada',
        role: 'Recruiter',
        tags: ['HR-Team', 'Remote']
      }
    }),

    // Finance team
    prisma.employee.create({
      data: {
        email: 'finance.cfo@acme.corp',
        firstName: 'Richard',
        lastName: 'White',
        department: 'Finance',
        location: 'United States',
        role: 'CFO',
        tags: ['VIP', 'Executive', 'Finance-Lead']
      }
    }),

    prisma.employee.create({
      data: {
        email: 'finance.analyst@acme.corp',
        firstName: 'Anna',
        lastName: 'Wilson',
        department: 'Finance',
        location: 'Australia',
        role: 'Financial Analyst',
        tags: ['Finance-Team', 'APAC-Team']
      }
    }),

    // Product team
    prisma.employee.create({
      data: {
        email: 'product.manager@acme.corp',
        firstName: 'Daniel',
        lastName: 'Moore',
        department: 'Product',
        location: 'United States',
        role: 'Product Manager',
        tags: ['Manager', 'Product-Team']
      }
    }),

    // Remote workers
    prisma.employee.create({
      data: {
        email: 'remote.contractor@acme.corp',
        firstName: 'Elena',
        lastName: 'Fernandez',
        department: 'Marketing',
        location: 'Singapore',
        role: 'Marketing Consultant',
        tags: ['Remote', 'Contractor', 'APAC-Team']
      }
    }),

    // Interns
    prisma.employee.create({
      data: {
        email: 'intern.summer@acme.corp',
        firstName: 'Jordan',
        lastName: 'Brown',
        department: 'Engineering',
        location: 'United States',
        role: 'Software Engineering Intern',
        tags: ['Intern', 'New-Hire']
      }
    })
  ]);

  console.log(`✅ Created ${employees.length} employees`);

  console.log('\n📊 Summary:');
  console.log(`   Lawyers: ${lawyers.length}`);
  console.log(`   Employees: ${employees.length}`);
  console.log('\n✅ Test data seeded successfully!');
  console.log('\n📌 Access Prisma Studio at: http://localhost:5555');
  console.log('\n🧪 Test Scenarios:');
  console.log('   1. VIP Executive (CEO) requesting Employment Contract → Should route to Sarah Chen (VIP + specialty + availability)');
  console.log('   2. Australian Sales Rep requesting Sales Contract → Should route to David Kim (location + specialty + availability)');
  console.log('   3. Marketing VP requesting Marketing Review → Should route to Lisa Thompson (VIP + specialty)');
  console.log('   4. Remote engineer requesting Employment Contract in Australia → Should route to Michael Rodriguez (location + remote tag)');
  console.log('   5. Regular employee with common request → Should avoid Robert Brown (no availability)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
