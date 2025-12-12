/*
  Warnings:

  - You are about to drop the column `firstName` on the `Lawyer` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `Lawyer` table. All the data in the column will be lost.
  - You are about to drop the `LawyerSkill` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LawyerSkill" DROP CONSTRAINT "LawyerSkill_lawyerId_fkey";

-- AlterTable
ALTER TABLE "Lawyer" DROP COLUMN "firstName",
DROP COLUMN "lastName",
ADD COLUMN     "calendarAvailability" JSONB,
ADD COLUMN     "departments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "LawyerSkill";
