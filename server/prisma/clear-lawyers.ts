import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Clearing lawyer data...');

  // Delete related records first
  await prisma.lawyerSkill.deleteMany();
  console.log('   Deleted LawyerSkill records');

  // Delete lawyers
  await prisma.lawyer.deleteMany();
  console.log('   Deleted Lawyer records');

  console.log('✅ Lawyer data cleared successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error clearing data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
