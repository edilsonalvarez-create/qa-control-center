-- Drive OAuth connection + daily sync run history
CREATE TABLE "DriveConnection" (
    "id" TEXT NOT NULL,
    "googleEmail" TEXT,
    "folderId" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DriveSyncRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL,
    "filesSeen" INTEGER NOT NULL DEFAULT 0,
    "filesImported" INTEGER NOT NULL DEFAULT 0,
    "filesSkipped" INTEGER NOT NULL DEFAULT 0,
    "filesPreview" INTEGER NOT NULL DEFAULT 0,
    "filesFailed" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "DriveSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DriveSyncRun_startedAt_idx" ON "DriveSyncRun"("startedAt");
