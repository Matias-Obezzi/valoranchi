# JavaScript

JavaScript applications can interact with the local Riot Client session either directly via in-process library imports (`@valoranchi/riot-client`) or by spawning the `riotclient` CLI as a child process.

## Setup

Install the library in your Node.js project:

```bash
npm install @valoranchi/riot-client
```

If you plan to use the command-line interface directly or spawn it via `child_process`, install it globally:

```bash
npm install -g @valoranchi/riot-client
```

## Read

You can read player information and owned items either using the library directly or through the CLI.

### Library (ESM)

Read the current player's profile and collection, printing the first owned skin for every weapon:

<<< @/../examples/node/read.mjs{js}

### Library (CommonJS)

In CommonJS projects, load the library via dynamic `import()` or invoke the CLI:

<<< @/../examples/node/read.cjs{js}

### Spawning the CLI with child_process

If you prefer to invoke the CLI binary from Node.js, spawn `riotclient`:

```js
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const { stdout: whoamiOut } = await execFileAsync("riotclient", ["whoami"]);
const player = JSON.parse(whoamiOut);
console.log(`Player: ${player.gameName}#${player.tagLine} (${player.region})`);

const { stdout: collectionOut } = await execFileAsync("riotclient", ["owned-items", "--language", "en-US"]);
const collection = JSON.parse(collectionOut);
for (const weapon of collection.weapons) {
  const firstSkin = weapon.skins[0];
  if (firstSkin) {
    console.log(`- ${weapon.name}: ${firstSkin.name}`);
  }
}
```

## Write with Validation

Every mutation is validated before any HTTP call reaches Riot's servers.

### Library Usage

The library provides `validateEquip` for dry runs and `equip` to apply mutations. In case of validation errors, a `ValidationError` is thrown with an error `reason`:

<<< @/../examples/node/write.mjs{js}

### CLI Usage via child_process

When using the CLI, omit `--yes` to perform a dry run. Add `--yes` to apply the update. If validation fails, the process exits with code `6` and details are written to `stderr`:

```js
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cardUuid = "0819fbcd-4bd4-c379-5384-52803440f2b2";

// 1. Dry run (default)
const { stdout: dryRunOut } = await execFileAsync("riotclient", ["equip", "--card", cardUuid]);
console.log("Dry run payload prepared:", JSON.parse(dryRunOut).Identity.PlayerCardID);

// 2. Execute write with --yes
try {
  const { stdout } = await execFileAsync("riotclient", ["equip", "--card", cardUuid, "--yes"]);
  console.log("Write executed successfully:", JSON.parse(stdout));
} catch (error) {
  if (error.code === 6 || error.status === 6) {
    const errPayload = JSON.parse(error.stderr);
    console.error(`Validation failed with reason: ${errPayload.error.reason}`);
    console.error("Message:", errPayload.error.message);
  } else {
    throw error;
  }
}
```

## Events

Subscribe to real-time WebSocket events from the local client.

### Library Emitter

Connect to the live WebSocket stream and listen for friends and messages:

<<< @/../examples/node/events.mjs{js}

### Streaming CLI Output (`watch`)

Spawn `riotclient watch` and consume events line-by-line using `readline`:

```js
import { spawn } from "node:child_process";
import readline from "node:readline";

const child = spawn("riotclient", ["watch", "--only", "friend:presence,message"]);
const rl = readline.createInterface({ input: child.stdout });

rl.on("line", (line) => {
  if (!line.trim()) return;
  const event = JSON.parse(line);
  if (event.event === "friend:presence") {
    const { friend, change } = event.data;
    console.log(`Presence update: ${friend.gameName} is now ${change} (${friend.presence.state})`);
  } else if (event.event === "message") {
    const msg = event.data;
    console.log(`[${msg.from.gameName}]: ${msg.body}`);
  }
});

process.on("SIGINT", () => {
  child.kill();
  process.exit(0);
});
```

## Types

Although JavaScript is dynamically typed, you can use JSDoc annotations or TypeScript definitions exported by the package for full autocompletion in editors such as VS Code.

Alternatively, you can generate JavaScript definitions and JSDoc typedefs from the JSON schemas using `quicktype`:

```bash
# Generate JavaScript models with JSDoc typing
npx quicktype schema/OwnedItems.json --src-lang schema -l javascript -o OwnedItems.js
```

Use the generated classes to parse CLI output:

```js
import { toOwnedItems } from "./OwnedItems.js";

const { stdout } = await execFileAsync("riotclient", ["owned-items"]);
const collection = toOwnedItems(stdout);
console.log(`Loaded collection for ${collection.player.gameName}`);
```
