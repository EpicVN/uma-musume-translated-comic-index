// scripts/register-commands.ts
import * as dotenv from "dotenv";
dotenv.config();

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!BOT_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    "❌ Missing DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID in .env",
  );
  process.exit(1);
}

const commands = [
  {
    name: "scrape",
    description:
      "Manually scrape a translated comic post from Twitter/X or Pixiv",
    options: [
      {
        name: "url",
        description:
          "Translated post URL on Twitter/X (https://x.com/.../status/...)",
        type: 3, // STRING
        required: true,
      },
      {
        name: "original_url",
        description:
          "Original raw source URL (Twitter or Pixiv) if quote failed or unlinked",
        type: 3, // STRING
        required: false,
      },
      {
        name: "lang",
        description: "Translation language (default: en)",
        type: 3, // STRING
        required: false,
        choices: [
          { name: "English (en)", value: "en" },
          { name: "Vietnamese (vi)", value: "vi" },
        ],
      },
    ],
  },
];

async function registerCommands() {
  console.log("⏳ Registering Slash Commands with Discord API...");
  const url = `https://discord.com/api/v10/applications/${CLIENT_ID}/guilds/${GUILD_ID}/commands`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ Registration failed [Status ${res.status}]:`, errorText);
  } else {
    console.log("✅ Successfully registered slash command: /scrape");
  }
}

registerCommands();
