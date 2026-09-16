-- Acceptance criteria field on TestCase: what input data, in what format,
-- validated against what source — so "correctly" isn't left to interpretation.

ALTER TABLE "TestCase" ADD COLUMN "acceptanceCriteria" TEXT;
