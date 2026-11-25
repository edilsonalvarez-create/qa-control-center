-- A run with any case left unexecuted is PENDING as a whole.
ALTER TYPE "RunStatus" ADD VALUE IF NOT EXISTS 'PENDING';
