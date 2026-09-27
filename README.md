# @valoranchi/riot-client

A TypeScript library and command-line tool for reading the local signed-in Riot Client session and retrieving player inventory, loadout, wallet balances, friends roster, presence, chat messages, and storefront offers for VALORANT.

## Installation

```bash
npm install @valoranchi/riot-client
```

Or run the CLI directly via npx:

```bash
npx @valoranchi/riot-client whoami
```

## Node Usage

Import `RiotClient` and call any of the public view model methods:

```ts
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient({ language: "en-US" });

// 1. Get signed-in player identity and region
const player = await client.whoami();
console.log(player);

// 2. Get full owned inventory (weapons, skins, chromas, buddies, etc.)
const collection = await client.ownedItems({ language: "en-US" });
console.log(collection);

// 3. Get currently equipped loadout
const loadout = await client.loadout();
console.log(loadout);

// 4. Get currency balances (VP, Radianite, Kingdom Credits)
const wallet = await client.wallet();
console.log(wallet);

// 5. Get friends roster and presence
const friends = await client.friends();
console.log(friends);

// 6. Get incoming/outgoing friend requests and blocked players
const requests = await client.friendRequests();
const blocked = await client.blocked();

// 7. Get conversations and messages
const conversations = await client.conversations();
const messages = await client.messages();

// 8. Get storefront rotation (daily, night market, bundles, accessories, radianite)
const store = await client.store({ language: "en-US" });
console.log(store);

// Close the local loopback client agent when finished
await client.close();
```

## CLI Usage

The package includes the `riotclient` binary.

```bash
riotclient whoami
riotclient owned-items --language en-US --pretty
riotclient loadout
riotclient wallet
riotclient friends
riotclient friend-requests
riotclient blocked
riotclient conversations
riotclient messages --cid <conversation-id>
riotclient store --pretty
```

Example trimmed output from `riotclient whoami --pretty`:

```json
{
  "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
  "gameName": "Player",
  "tagLine": "NA1",
  "region": "na",
  "shard": "na",
  "accountLevel": 128
}
```

Example trimmed output from `riotclient store --pretty`:

```json
{
  "player": {
    "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
    "gameName": "Player",
    "tagLine": "NA1",
    "region": "na",
    "shard": "na",
    "accountLevel": 128
  },
  "fetchedAt": "2026-09-27T12:00:00.000Z",
  "daily": {
    "endsAt": "2026-09-28T00:00:00.000Z",
    "offers": [
      {
        "offerId": "4324a482-47da-4521-b3b0-4dbfcfefd779",
        "item": {
          "kind": "skin",
          "uuid": "8908f237-47b2-031a-e905-1a89c93cc8f5",
          "name": "Prime Vandal",
          "weapon": "Vandal",
          "tier": {
            "uuid": "e046854e-406c-37f4-6607-19a9ba8426fc",
            "name": "Exclusive",
            "rank": 5,
            "icon": "https://media.valorant-api.com/contenttiers/exclusive.png"
          },
          "icon": "https://media.valorant-api.com/weaponskinlevels/7209796e-4f76-88c9-04fa-fb81498b5e9d/displayicon.png",
          "levelUuid": "7209796e-4f76-88c9-04fa-fb81498b5e9d"
        },
        "cost": {
          "currency": "Valorant Points",
          "currencyUuid": "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
          "amount": 1775
        }
      }
    ]
  },
  "nightMarket": null,
  "bundles": {
    "endsAt": "2026-10-05T00:00:00.000Z",
    "items": []
  },
  "accessories": null,
  "radianite": []
}
```

CLI exit codes:

- `0`: Success (JSON written to stdout)
- `2`: Riot Client is not running (`RIOT_CLIENT_NOT_RUNNING`)
- `3`: Riot Client is not ready yet (`RIOT_CLIENT_NOT_READY`)
- `4`: Region could not be resolved (`REGION_UNKNOWN`)
- `5`: Remote Riot API request failed (`RIOT_API_ERROR`)
- `1`: Unexpected failure

On failure, error information is formatted as `{ "error": { "code": string, "message": string } }` and output to stderr.

## From Other Languages

Any runtime can spawn the `riotclient` binary as a child process and parse stdout as JSON. Type definitions can be generated directly from the committed JSON Schemas in `schema/` using tools such as `quicktype`:

```bash
npx quicktype schema/OwnedItems.json -o OwnedItems.cs --namespace Valoranchi
```

Example C# snippet using `System.Diagnostics.Process`:

```csharp
using System;
using System.Diagnostics;
using System.Text.Json;

var startInfo = new ProcessStartInfo
{
    FileName = "riotclient",
    Arguments = "whoami",
    RedirectStandardOutput = true,
    RedirectStandardError = true,
    UseShellExecute = false,
    CreateNoWindow = true,
};

using var process = Process.Start(startInfo);
string output = process.StandardOutput.ReadToEnd();
process.WaitForExit();

if (process.ExitCode == 0)
{
    using var doc = JsonDocument.Parse(output);
    Console.WriteLine($"Player: {doc.RootElement.GetProperty("gameName").GetString()}");
}
```

## How Authentication Works

1. The local Riot Client creates a lockfile at `%LOCALAPPDATA%\Riot Games\Riot Client\Config\lockfile`.
2. The library reads the lockfile port and basic authentication password.
3. Credentials are exchanged with the loopback API over local TLS to obtain entitlements and access tokens.
4. Active region and shard are resolved from product sessions or game logs.
5. The resulting session headers authenticate subsequent requests directly to Riot PVP game servers.

## Catalogue Cache

Names, images, bundles, and tiers come from valorant-api.com. The catalogue for each language is stored on disk, under `%LOCALAPPDATA%\valoranchi-riot-client\catalogue` on Windows and the system temp directory elsewhere, keyed by the game version, so it is downloaded once per patch. Pass `catalogueDir` to `RiotClient` to move it, or `null` to keep it in memory only.

## Response Cache

Riot answers are fetched live by default. To reuse them for a while, pass `responseCache: { ttlMs: 60_000 }` to `RiotClient`, or `--cache 60` to the CLI. Entries are stored per player and endpoint under `%LOCALAPPDATA%\valoranchi-riot-client\responses`, hold only the response body, never a token, and are refetched once older than the TTL. Keep the TTL short: a purchase or a loadout change is invisible until it expires.

Chat data (friends, presence, friend requests, blocked players, conversations, and messages) comes directly from the local Riot Client loopback API and is never cached.

## Token Host Rule

Access tokens and entitlements JWTs are strictly scoped. They may only ever be sent to hosts matching `*.pvp.net`, `*.riotgames.com`, or loopback `127.0.0.1`. The HTTP gateway enforces this policy and throws a `ForbiddenHostError` before sending any request that would transmit credentials to an unauthorized host. Requests to public endpoints such as `valorant-api.com` never carry authorization headers.

## What It Does Not Do

- No store purchases or transactional operations
- No sending chat messages or modifying friend relationships
- No automation, bots, or match orchestration
- No writing or mutating equipped loadouts
- No telemetry or credential logging

## Disclaimer

This project is an unofficial tool and is not endorsed by, directly affiliated with, maintained, authorized, or sponsored by Riot Games, Inc. VALORANT and all related properties are trademarks or registered trademarks of Riot Games, Inc.
