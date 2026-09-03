-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OriginalPost" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "tweetUrl" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "content" TEXT,
    "artistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OriginalPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslatedPost" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "tweetUrl" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "postedAt" TIMESTAMP(3) NOT NULL,
    "translatorId" TEXT NOT NULL,
    "originalPostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranslatedPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Creator_handle_key" ON "Creator"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "OriginalPost_tweetId_key" ON "OriginalPost"("tweetId");

-- CreateIndex
CREATE UNIQUE INDEX "TranslatedPost_tweetId_key" ON "TranslatedPost"("tweetId");

-- AddForeignKey
ALTER TABLE "OriginalPost" ADD CONSTRAINT "OriginalPost_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslatedPost" ADD CONSTRAINT "TranslatedPost_translatorId_fkey" FOREIGN KEY ("translatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslatedPost" ADD CONSTRAINT "TranslatedPost_originalPostId_fkey" FOREIGN KEY ("originalPostId") REFERENCES "OriginalPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
