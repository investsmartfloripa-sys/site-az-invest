-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AUTHOR', 'STAFF');
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "authorId" INTEGER;
ALTER TABLE "User" ADD COLUMN "inviteToken" TEXT;
ALTER TABLE "User" ADD COLUMN "inviteExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- Migrate roles
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING (
  CASE
    WHEN "role" = 'MASTER' THEN 'ADMIN'::"UserRole"
    WHEN "role" = 'EDITOR' THEN 'STAFF'::"UserRole"
    ELSE 'AUTHOR'::"UserRole"
  END
);
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'AUTHOR';

-- AlterTable Post
ALTER TABLE "Post" ADD COLUMN "contentHtml" TEXT;
ALTER TABLE "Post" ADD COLUMN "status" "PostStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Post" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "reviewedById" INTEGER;
ALTER TABLE "Post" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "Post" ADD COLUMN "publishedAt" TIMESTAMP(3);

UPDATE "Post" SET "status" = 'APPROVED', "publishedAt" = COALESCE("updatedAt", NOW()) WHERE "published" = true;
UPDATE "Post" SET "status" = 'DRAFT' WHERE "published" = false;
UPDATE "Post" SET "published" = ("status" = 'APPROVED');

-- CreateTable AnalyticsEvent
CREATE TABLE "AnalyticsEvent" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "referrer" TEXT,
    "authorId" INTEGER,
    "postId" INTEGER,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");
CREATE INDEX "AnalyticsEvent_authorId_createdAt_idx" ON "AnalyticsEvent"("authorId", "createdAt");
CREATE INDEX "AnalyticsEvent_postId_createdAt_idx" ON "AnalyticsEvent"("postId", "createdAt");
CREATE INDEX "AnalyticsEvent_path_createdAt_idx" ON "AnalyticsEvent"("path", "createdAt");

-- CreateTable DataSourceSnapshot
CREATE TABLE "DataSourceSnapshot" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "freshness" TEXT,
    "generatedAt" TIMESTAMP(3),
    "workflowName" TEXT,
    "workflowStatus" TEXT,
    "workflowUrl" TEXT,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataSourceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataSourceSnapshot_key_key" ON "DataSourceSnapshot"("key");

-- CreateTable AuditLog
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "User_authorId_key" ON "User"("authorId");
CREATE UNIQUE INDEX "User_inviteToken_key" ON "User"("inviteToken");
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");
