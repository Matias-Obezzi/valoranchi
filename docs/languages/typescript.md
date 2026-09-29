# TypeScript

TypeScript provides first-class support for `@valoranchi/riot-client`. All models, event payloads, options, and errors are fully typed out of the box.

## Setup

Install the library along with TypeScript and Node types:

```bash
npm install @valoranchi/riot-client
npm install --save-dev typescript @types/node
```

Ensure your `tsconfig.json` targets modern Node with `"moduleResolution": "NodeNext"` or `"Bundler"`.

## Read

Import `RiotClient` and typed models directly from `@valoranchi/riot-client`. The example below reads the player profile and owned items, iterating over weapons and printing the first owned skin for each weapon:

```ts
import { RiotClient, type OwnedItems, type Player } from "@valoranchi/riot-client";

const client = new RiotClient({ language: "en-US" });

try {
  const player: Player = await client.account.whoami();
  console.log(`Signed in as: ${player.gameName}#${player.tagLine} (${player.region})`);

  const collection: OwnedItems = await client.account.ownedItems();
  console.log(`Generated: ${collection.generatedAt}`);
  for (const weapon of collection.weapons) {
    const firstSkin = weapon.skins[0];
    if (firstSkin) {
      console.log(`- ${weapon.name}: ${firstSkin.name}`);
    }
  }
} finally {
  await client.close();
}
```

## Write with Validation

Every mutation is validated locally before hitting Riot's network endpoints. If an item is unowned, a `ValidationError` is thrown locally.

Use `client.account.validateEquip()` for a local dry run (returns the prepared Riot payload), and `client.account.equip()` to execute the write. Catching `ValidationError` allows you to inspect the typed `.reason` and `.details`:

```ts
import { RiotClient, ValidationError, type Loadout } from "@valoranchi/riot-client";

const client = new RiotClient();

try {
  const cardUuid = "0819fbcd-4bd4-c379-5384-52803440f2b2";

  // 1. Dry run: validate locally without network mutation
  console.log("Validating card equip (dry run)...");
  const payload = await client.account.validateEquip({ card: cardUuid });
  console.log("Validated payload card ID:", payload.Identity.PlayerCardID);

  // 2. Perform validated mutation
  console.log("Applying card equip...");
  const loadout: Loadout = await client.account.equip({ card: cardUuid });
  console.log(`Card equipped for player: ${loadout.player.gameName}`);
} catch (error: unknown) {
  if (error instanceof ValidationError) {
    // Narrowed to ValidationError: reason, code, and details are available
    console.error(`Validation failed [${error.code}]: ${error.reason}`);
    console.error(`Message: ${error.message}`);
    if (error.details) {
      console.error("Details:", error.details);
    }
  } else {
    throw error;
  }
} finally {
  await client.close();
}
```

## Events

Subscribe to typed WebSocket events from the local Riot Client using `client.events()`. Event signatures are strictly typed via TypeScript generics:

```ts
import { RiotClient, type Friend, type Message } from "@valoranchi/riot-client";

const client = new RiotClient();
const events = client.events();

events.on("connected", () => {
  console.log("WebSocket connected to Riot Client");
});

events.on("disconnected", () => {
  console.log("WebSocket disconnected from Riot Client");
});

events.on(
  "friend:presence",
  ({ friend, change }: { friend: Friend; change: "update" | "offline" }) => {
    console.log(
      `Friend ${friend.gameName}#${friend.tagLine} is now ${change} (${friend.presence.state})`,
    );
  },
);

events.on("message", (msg: Message) => {
  console.log(`[${msg.from.gameName}]: ${msg.body}`);
});

// Close socket connection when finished
await client.close();
```

## Complete Runnable Example

The complete, verified TypeScript example is included below:

<<< @/../examples/node/typed.ts{ts}

## Types

The `@valoranchi/riot-client` package exports all domain types directly:

```ts
import type {
  Player,
  OwnedItems,
  OwnedWeapon,
  OwnedSkin,
  OwnedCard,
  Loadout,
  Friend,
  Message,
  Store,
  Match,
  Party,
  Wallet,
} from "@valoranchi/riot-client";
```

If you are writing an external tool that only consumes the CLI output in TypeScript without importing the client library, you can generate TypeScript interfaces directly from the JSON Schemas with `quicktype`:

```bash
npx quicktype schema/OwnedItems.json --src-lang schema -l typescript -o OwnedItems.ts
```
