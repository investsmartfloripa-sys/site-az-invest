-- Data Health v2: data do último dado + timestamp da última run do workflow
ALTER TABLE "DataSourceSnapshot" ADD COLUMN "lastDataLabel" TEXT;
ALTER TABLE "DataSourceSnapshot" ADD COLUMN "workflowRunAt" TIMESTAMP(3);
