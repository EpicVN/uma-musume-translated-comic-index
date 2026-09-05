const REPO = process.env.REPO_URL;

interface GitTree {
  sha: string;
  truncated: boolean;
  tree: {
    path: string;
    type: string;
  }[];
}

export interface CubariFile {
  id: string;
  data: object;
  cubariLink: string;
}

export interface CubariData {
  cover: string;
  title: string;
  artist: string;
  author: string;
  description: string;
  chapters: Record<string, CubariChapter>;
}

export interface CubariChapter {
  groups: object;
  last_updated: string;
  title: string;
  volume: string;
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json();
}

export async function getReaderFiles() {
  const tree: GitTree = await fetchJson(
    `https://api.github.com/repos/${REPO}/git/trees/HEAD?recursive=1`,
  );

  if (tree.truncated) {
    throw new Error("GitHub returned an incomplete file list");
  }

  const files = tree.tree.filter(
    (file) => file.type === "blob" && file.path.toLowerCase().endsWith(".json"),
  );

  return Promise.all(
    files.map(async (file) => {
      const path = file.path.split("/").map(encodeURIComponent).join("/");

      const data: CubariData = await fetchJson(
        `https://raw.githubusercontent.com/${REPO}/${tree.sha}/${path}`,
      );

      const id = Buffer.from(file.path.replace(".json", ""), "utf-8").toString(
        "base64",
      );

      const gistSource = `raw/${REPO}/${tree.sha}/${path}`;

      const gistSourceBase64 = Buffer.from(gistSource, "utf-8").toString(
        "base64",
      );

      const cubariLink = `https://cubari.moe/read/gist/${gistSourceBase64}`;

      return { id: id, data: data, cubariLink: cubariLink };
    }),
  );
}
