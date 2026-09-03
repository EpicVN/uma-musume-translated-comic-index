-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "filterTags" TEXT DEFAULT '#UmaTranslations',
ADD COLUMN     "isTarget" BOOLEAN NOT NULL DEFAULT false;
