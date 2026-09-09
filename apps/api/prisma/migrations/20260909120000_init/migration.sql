-- CreateSchema
CREATE TYPE "Role" AS ENUM ('ADMIN', 'QA_MANAGER', 'QA', 'VIEWER');
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'REQUIRES_REVIEW');
CREATE TYPE "TestType" AS ENUM ('UNIT', 'INTEGRATION', 'E2E', 'API', 'PERFORMANCE', 'SECURITY', 'FUNCTIONAL', 'RTM', 'BOUNDARY', 'REGRESSION', 'SMOKE', 'UNKNOWN');
CREATE TYPE "Environment" AS ENUM ('DEV', 'QA', 'TEST', 'STAGING', 'PROD', 'UNKNOWN');
CREATE TYPE "CaseStatus" AS ENUM ('PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'UNKNOWN', 'REQUIRES_REVIEW');
CREATE TYPE "RunStatus" AS ENUM ('PASSED', 'FAILED', 'BLOCKED', 'IN_PROGRESS', 'UNKNOWN');
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');
CREATE TYPE "DefectStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'FIXED', 'READY_FOR_RETEST', 'RETEST_FAILED', 'CLOSED', 'REOPENED');
CREATE TYPE "EvidenceType" AS ENUM ('SCREENSHOT', 'VIDEO', 'LOG', 'PDF', 'DOCX', 'EXCEL', 'JSON', 'HTML', 'OTHER');
CREATE TYPE "ImportJobStatus" AS ENUM ('UPLOADED', 'PARSING', 'PREVIEW', 'COMMITTED', 'REJECTED', 'FAILED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "client" TEXT,
    "product" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Project_name_key" ON "Project"("name");

CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Module_projectId_name_key" ON "Module"("projectId", "name");
ALTER TABLE "Module" ADD CONSTRAINT "Module_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Unknown',
    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SourceFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sourceUrl" TEXT,
    "sourceFileId" TEXT,
    "sourceModifiedAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SourceFile_contentHash_idx" ON "SourceFile"("contentHash");
CREATE INDEX "SourceFile_sourceFileId_idx" ON "SourceFile"("sourceFileId");
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "moduleId" TEXT,
    "testType" "TestType" NOT NULL DEFAULT 'UNKNOWN',
    "environment" "Environment" NOT NULL DEFAULT 'UNKNOWN',
    "executionDate" TIMESTAMP(3) NOT NULL,
    "tester" TEXT,
    "version" TEXT,
    "commit" TEXT,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "passed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "blocked" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER,
    "status" "RunStatus" NOT NULL DEFAULT 'UNKNOWN',
    "observations" TEXT,
    "fingerprint" TEXT,
    "sourceFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TestRun_projectId_executionDate_idx" ON "TestRun"("projectId", "executionDate");
CREATE INDEX "TestRun_fingerprint_idx" ON "TestRun"("fingerprint");
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "requirementId" TEXT,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "TestType" NOT NULL DEFAULT 'UNKNOWN',
    "priority" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'UNKNOWN',
    "executionDate" TIMESTAMP(3),
    "fingerprint" TEXT,
    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TestCase_fingerprint_idx" ON "TestCase"("fingerprint");
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Defect" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT,
    "testRunId" TEXT,
    "projectId" TEXT NOT NULL,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'UNKNOWN',
    "priority" TEXT,
    "status" "DefectStatus" NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "detectedDate" TIMESTAMP(3),
    "resolvedDate" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Defect_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT,
    "testCaseId" TEXT,
    "defectId" TEXT,
    "sourceFileId" TEXT,
    "type" "EvidenceType" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "Defect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "commit" TEXT,
    "releaseDate" TIMESTAMP(3),
    "environment" "Environment" NOT NULL DEFAULT 'UNKNOWN',
    "health" TEXT NOT NULL DEFAULT 'Unknown',
    "notes" TEXT,
    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Release" ADD CONSTRAINT "Release_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "QaReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "reportType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "summary" TEXT,
    "sourceFileId" TEXT,
    CONSTRAINT "QaReport_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "QaReport" ADD CONSTRAINT "QaReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QaReport" ADD CONSTRAINT "QaReport_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceFileId" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'UPLOADED',
    "previewJson" JSONB,
    "warnings" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),
    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DuplicateCandidate" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "existingId" TEXT,
    "existingType" TEXT,
    "suggested" TEXT NOT NULL DEFAULT 'REVIEW',
    CONSTRAINT "DuplicateCandidate_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DataConflict" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT,
    "field" TEXT NOT NULL,
    "leftValue" TEXT NOT NULL,
    "rightValue" TEXT NOT NULL,
    "leftSource" TEXT,
    "rightSource" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Requires review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataConflict_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "DataConflict" ADD CONSTRAINT "DataConflict_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
