-- QA release-readiness call per Test Run, editable from the Test Runs panel.
-- NULL = not decided yet; the UI suggests GO/NO_GO from the run's status
-- until a QA picks one explicitly.

ALTER TABLE "TestRun" ADD COLUMN "goNoGo" TEXT;
