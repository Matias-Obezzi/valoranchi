/* eslint-disable @typescript-eslint/no-require-imports */
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

async function main() {
  // Option A: Dynamic import of the ESM client library
  const { RiotClient } = await import("@valoranchi/riot-client");
  const client = new RiotClient({ language: "en-US" });

  try {
    const player = await client.account.whoami();
    console.log(`[Library] Player: ${player.gameName}#${player.tagLine}`);

    const collection = await client.account.ownedItems();
    for (const weapon of collection.weapons) {
      const firstSkin = weapon.skins[0];
      if (firstSkin) {
        console.log(`- ${weapon.name}: ${firstSkin.name}`);
      }
    }
  } finally {
    await client.close();
  }

  // Option B: Spawning the riotclient CLI from CommonJS
  try {
    const { stdout } = await execFileAsync("riotclient", ["whoami"]);
    const cliPlayer = JSON.parse(stdout);
    console.log(`[CLI] Player: ${cliPlayer.gameName}#${cliPlayer.tagLine}`);
  } catch (err) {
    // riotclient exits non-zero if client not running or failed
    if (err && err.code === "ENOENT") {
      console.error("riotclient CLI not found in PATH");
    }
  }
}

main().catch(console.error);
