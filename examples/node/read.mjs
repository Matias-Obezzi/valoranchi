import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient({ language: "en-US" });

try {
  const player = await client.account.whoami();
  console.log(`Signed in as: ${player.gameName}#${player.tagLine} (${player.region})`);

  const collection = await client.account.ownedItems();
  console.log(`Collection generated at: ${collection.generatedAt}`);
  for (const weapon of collection.weapons) {
    const firstSkin = weapon.skins[0];
    if (firstSkin) {
      console.log(`- ${weapon.name}: ${firstSkin.name}`);
    }
  }
} finally {
  await client.close();
}
