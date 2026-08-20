-- A nullable explicit override. NULL retains the policy-derived form so the
-- organization can evolve defaults without rewriting individual buildings.
ALTER TABLE "Building" ADD COLUMN "reportFormOverride" TEXT;
