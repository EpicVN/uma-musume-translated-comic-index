# UmaIndex - Uma Musume Comic Archive

A Next.js archive indexing translated *Uma Musume: Pretty Derby* short comics from X (Twitter).

---

## Tech Stack

* **Frontend & Backend:** Next.js (App Router), Tailwind CSS
* **Database & ORM:** PostgreSQL (Neon Serverless), Prisma
* **Scraper:** Playwright (Node.js)

---

## Setup

1. **Clone & install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment (`.env`):**
   ```env
   # NeonDB connection strings
   DATABASE_URL="postgresql://user:password@ep-xyz-pooler.neon.tech/neondb?sslmode=require"
   DIRECT_URL="postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require"

   # Internal Security
   CRON_SECRET="your-random-secure-string"

   # X (Twitter) Scraper Credentials
   TWITTER_AUTH_TOKEN="your_auth_token_cookie"
   TWITTER_CT0="your_ct0_cookie"
   ```

3. **Initialize database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

---

## Translator Configuration

Target translators and search keywords are managed directly in `config/translators.json`. You can add or modify targets without touching the scraper codebase:

```json
[
  {
    "name": "Translator Name",
    "handle": "TwitterHandleWithoutAt",
    "language": "en",
    "keywords": ["UmaTranslations", "ウマ娘英訳"],
    "requireKeywordMatch": true
  }
]
```

* `handle`: X username without the `@` symbol.
* `keywords`: Tags or project search terms queried alongside the user handle.
* `requireKeywordMatch`: When `true`, ensures scraped posts must contain at least one keyword.

---

## Scraping & Scripts

* **Full Historical Crawl:** Scrapes all past translations across quarter-sliced intervals:
  ```bash
  npx tsx scripts/deep-scrape-range.ts
  ```

* **Latest Updates Crawl:** Fetches only newly posted translations from recent dates:
  ```bash
  npx tsx scripts/update-latest.ts
  ```

* **Re-run Tagging:** Re-scans existing posts in the database with updated character dictionaries:
  ```bash
  npx tsx scripts/retag-posts.ts
  ```

---

## Pipeline Overview

* **Timeline Search:** Scrapes target translators via date-sliced search queries (`from:user (keywords) since:... until:...`).
* **Source Resolution:** Parses quote-tweets or embedded X status links to link the canonical original Japanese artist.
* **Auto-Tagging:** Scans both translation text and original post content against character dictionaries (EN/JP/Slug) to bind relational tags.
