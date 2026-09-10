-- Módulo "Matriz QA": registro manual de casos que alimenta los paneles.
-- Marca de origen en Run/Case/Defect + campos extra de la matriz estándar.

ALTER TABLE "TestRun" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'IMPORT';

ALTER TABLE "TestCase" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'IMPORT';
ALTER TABLE "TestCase" ADD COLUMN "defectRef" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TestCase" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Defect" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'IMPORT';

CREATE INDEX "TestCase_origin_idx" ON "TestCase"("origin");
