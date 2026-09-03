-- CreateEnum
CREATE TYPE "CreatorRole" AS ENUM ('ARTIST', 'TRANSLATOR', 'BOTH');

-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('CHARACTER', 'THEME', 'EVENT');

-- DropForeignKey
ALTER TABLE "OriginalPost" DROP CONSTRAINT "OriginalPost_artistId_fkey";

-- DropForeignKey
ALTER TABLE "TranslatedPost" DROP CONSTRAINT "TranslatedPost_translatorId_fkey";

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "role" "CreatorRole" NOT NULL DEFAULT 'ARTIST',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "filterTags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OriginalPost" ADD COLUMN     "mediaCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TranslatedPost" ADD COLUMN     "content" TEXT,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jpName" TEXT,
    "category" "TagCategory" NOT NULL DEFAULT 'CHARACTER',
    "colorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_slug_idx" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_category_idx" ON "Tag"("category");

-- CreateIndex
CREATE INDEX "Tag_jpName_idx" ON "Tag"("jpName");

-- CreateIndex
CREATE INDEX "PostTag_postId_idx" ON "PostTag"("postId");

-- CreateIndex
CREATE INDEX "PostTag_tagId_idx" ON "PostTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");

-- CreateIndex
CREATE INDEX "Series_slug_idx" ON "Series"("slug");

-- CreateIndex
CREATE INDEX "Creator_handle_idx" ON "Creator"("handle");

-- CreateIndex
CREATE INDEX "Creator_role_idx" ON "Creator"("role");

-- CreateIndex
CREATE INDEX "OriginalPost_artistId_idx" ON "OriginalPost"("artistId");

-- CreateIndex
CREATE INDEX "OriginalPost_postedAt_idx" ON "OriginalPost"("postedAt" DESC);

-- CreateIndex
CREATE INDEX "OriginalPost_seriesId_idx" ON "OriginalPost"("seriesId");

-- CreateIndex
CREATE INDEX "TranslatedPost_translatorId_idx" ON "TranslatedPost"("translatorId");

-- CreateIndex
CREATE INDEX "TranslatedPost_originalPostId_idx" ON "TranslatedPost"("originalPostId");

-- CreateIndex
CREATE INDEX "TranslatedPost_postedAt_idx" ON "TranslatedPost"("postedAt" DESC);

-- AddForeignKey
ALTER TABLE "OriginalPost" ADD CONSTRAINT "OriginalPost_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OriginalPost" ADD CONSTRAINT "OriginalPost_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslatedPost" ADD CONSTRAINT "TranslatedPost_translatorId_fkey" FOREIGN KEY ("translatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "OriginalPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
