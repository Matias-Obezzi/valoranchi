import {
  RiotClient,
  ValidationError,
  type Friend,
  type Loadout,
  type Message,
  type OwnedItems,
  type Player,
} from "@valoranchi/riot-client";

async function main(): Promise<void> {
  const client = new RiotClient({ language: "en-US" });

  try {
    // 1. Read player identity and owned collection
    const player: Player = await client.account.whoami();
    console.log(`Signed in as: ${player.gameName}#${player.tagLine} (${player.region})`);

    const collection: OwnedItems = await client.account.ownedItems();
    console.log(`Inventory generated at: ${collection.generatedAt}`);
    for (const weapon of collection.weapons) {
      const firstSkin = weapon.skins[0];
      if (firstSkin) {
        console.log(`- ${weapon.name}: ${firstSkin.name}`);
      }
    }

    // 2. Write with validation (dry run first, then equip)
    const cardUuid = "0819fbcd-4bd4-c379-5384-52803440f2b2";
    console.log("Validating card equip (dry run)...");
    await client.account.validateEquip({ card: cardUuid });

    console.log("Equipping card...");
    const updated: Loadout = await client.account.equip({ card: cardUuid });
    console.log(`Equipped card for player: ${updated.player.gameName}`);
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      console.error(`Validation error [${error.code}]: reason=${error.reason}`);
      console.error(`Message: ${error.message}`);
      if (error.details) {
        console.error("Details:", error.details);
      }
    } else {
      console.error("Unexpected error:", error);
    }
  }

  // 3. Listen to real-time events
  const events = client.events();
  events.on("connected", () => {
    console.log("Connected to local Riot Client WebSocket");
  });

  events.on("friend:presence", ({ friend, change }: { friend: Friend; change: "update" | "offline" }) => {
    console.log(`Friend ${friend.gameName}#${friend.tagLine} is ${change} (${friend.presence.state})`);
  });

  events.on("message", (msg: Message) => {
    console.log(`[${msg.from.gameName}]: ${msg.body}`);
  });

  // 4. Close client connection
  await client.close();
}

void main();
