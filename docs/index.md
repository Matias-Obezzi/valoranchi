---
layout: home

hero:
  name: "@valoranchi/riot-client"
  text: "VALORANT Client Library & CLI"
  tagline: "Everything the Riot Client knows, as clean JSON, from Node or any language"
  actions:
    - theme: brand
      text: Getting Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /reference/
    - theme: alt
      text: GitHub
      link: https://github.com/Matias-Obezzi/valoranchi

features:
  - title: Validated Writes
    details: Local checks inspect your collection, inventory, and party state before sending mutation requests to Riot.
  - title: Real-Time Events
    details: Subscribe to live WebSocket events for friend presence, incoming messages, and game state changes.
  - title: Works from Any Language via CLI
    details: Spawn the command-line binary from C#, Rust, Python, or Go and read clean JSON output from stdout.
---

## Quick Start

Install the library using npm:

```bash
npm install @valoranchi/riot-client
```

Connect to your active local Riot session in TypeScript:

```ts
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient({ language: "en-US" });

const player = await client.account.whoami();
console.log(`Signed in as: ${player.gameName}#${player.tagLine}`);

const wallet = await client.account.wallet();
console.log(`VP: ${wallet.valorantPoints}, Radianite: ${wallet.radianite}`);

await client.close();
```

Run commands directly from the terminal via npx:

```bash
npx @valoranchi/riot-client whoami
npx @valoranchi/riot-client store --pretty
```
