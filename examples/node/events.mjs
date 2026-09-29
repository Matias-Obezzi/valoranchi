import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient();
const events = client.events();

events.on("connected", () => {
  console.log("Connected to local Riot Client WebSocket");
});

events.on("disconnected", () => {
  console.log("Disconnected from local Riot Client WebSocket");
});

events.on("friend:presence", ({ friend, change }) => {
  console.log(
    `Friend ${friend.gameName}#${friend.tagLine} is now ${change} (${friend.presence.state})`,
  );
});

events.on("message", (msg) => {
  console.log(`[${msg.from.gameName}]: ${msg.body}`);
});

console.log("Listening for real-time events. Press Ctrl+C to stop.");

process.on("SIGINT", async () => {
  console.log("\nClosing connection...");
  await client.close();
  process.exit(0);
});
