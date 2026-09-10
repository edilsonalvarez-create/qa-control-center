-- Catalog lookup lists + extra fields from Matriz QA estándar (Casos de Prueba)
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogItem_category_value_key" ON "CatalogItem"("category", "value");
CREATE INDEX "CatalogItem_category_idx" ON "CatalogItem"("category");

ALTER TABLE "TestCase" ADD COLUMN "moduleName" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "product" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "functionality" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "level" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "automatable" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "tool" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "preconditions" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "testData" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "steps" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "expected" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "expectedIntegration" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "actual" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "environment" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "cycle" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "executor" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "observations" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "evidenceUrl" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "requirementRef" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "release" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "sprint" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "severity" TEXT;
