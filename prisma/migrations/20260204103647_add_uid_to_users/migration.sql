-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "uid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_uid_key" ON "users"("uid") WHERE "uid" IS NOT NULL;


