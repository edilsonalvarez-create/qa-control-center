/*
  Warnings:

  - You are about to drop the column `defectRef` on the `TestCase` table. All the data in the column will be lost.
  - You are about to drop the column `environment` on the `TestCase` table. All the data in the column will be lost.
  - You are about to drop the column `evidenceUrl` on the `TestCase` table. All the data in the column will be lost.
  - You are about to drop the column `release` on the `TestCase` table. All the data in the column will be lost.
  - You are about to drop the column `requirementId` on the `TestCase` table. All the data in the column will be lost.
  - You are about to drop the column `severity` on the `TestCase` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "TestCase" DROP CONSTRAINT "TestCase_requirementId_fkey";

-- AlterTable
ALTER TABLE "DriveConnection" ALTER COLUMN "id" SET DEFAULT 'default';

-- AlterTable
ALTER TABLE "TestCase" DROP COLUMN "defectRef",
DROP COLUMN "environment",
DROP COLUMN "evidenceUrl",
DROP COLUMN "release",
DROP COLUMN "requirementId",
DROP COLUMN "severity";
