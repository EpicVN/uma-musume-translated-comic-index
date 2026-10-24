import { cache } from "react";

const REPO = process.env.REPO_URL || "fullmooncafe6015/full-moon-cafe-reader";

interface GitTree {
  sha: string;
  truncated: boolean;
  tree: {
    path: string;
    type: string;
  }[];
}

export interface CubariChapter {
  groups: object;
  last_updated: string;
  title: string;
  volume: string;
}

export interface CubariData {
  cover: string;
  title: string;
  artist: string;
  author: string;
  description: string;
  chapters: Record<string, CubariChapter>;
}

export interface CubariFile {
  id: string;
  data: CubariData;
  cubariLink: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    // GitHub API requires a User-Agent header
    "User-Agent": "ComicIndexer-Reader/1.0",
  };

  // Attach personal access token for GitHub API requests to lift rate limit (from 60 to 5,000 req/hr)
  if (process.env.GITHUB_TOKEN && url.includes("api.github.com")) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN.trim()}`;
  }

  const response = await fetch(url, {
    headers,
    // Cache data for 24 hours on Next.js server / build
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText} - ${errorBody}`,
    );
  }

  return response.json();
}

// Deduplicate concurrent requests across build workers using React cache
export const getReaderFiles = cache(async (): Promise<CubariFile[]> => {
  if (!REPO) {
    console.warn("⚠️ REPO_URL is not configured in environment variables.");
    return [];
  }

  try {
    const tree = await fetchJson<GitTree>(
      `https://api.github.com/repos/${REPO}/git/trees/HEAD?recursive=1`,
    );

    if (tree.truncated) {
      console.warn("⚠️ GitHub returned a truncated file list.");
    }

    const jsonFiles = tree.tree.filter(
      (file) =>
        file.type === "blob" && file.path.toLowerCase().endsWith(".json"),
    );

    // Use Promise.allSettled so a single malformed JSON file won't crash the entire build
    const results = await Promise.allSettled(
      jsonFiles.map(async (file) => {
        const path = file.path.split("/").map(encodeURIComponent).join("/");
        const rawUrl = `https://raw.githubusercontent.com/${REPO}/${tree.sha}/${path}`;

        const data = await fetchJson<CubariData>(rawUrl);

        const id = Buffer.from(
          file.path.replace(/\.json$/i, ""),
          "utf-8",
        ).toString("base64");

        const gistSource = `raw/${REPO}/${tree.sha}/${path}`;
        const gistSourceBase64 = Buffer.from(gistSource, "utf-8").toString(
          "base64",
        );
        const cubariLink = `https://cubari.moe/read/gist/${gistSourceBase64}`;

        return { id, data, cubariLink };
      }),
    );

    return results
      .filter(
        (res): res is PromiseFulfilledResult<CubariFile> =>
          res.status === "fulfilled" && Boolean(res.value.data),
      )
      .map((res) => res.value);
  } catch (error) {
    console.error("❌ Failed to fetch reader files from GitHub:", error);
    return [];
  }
});
