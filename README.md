# @valoranchi/riot-client

A TypeScript library and command-line tool for reading the local signed-in Riot Client session and retrieving player inventory, loadout, wallet balances, and identity information for VALORANT.

## Installation

```bash
npm install @valoranchi/riot-client
```

Or run the CLI directly via npx:

```bash
npx @valoranchi/riot-client whoami
```

## Node Usage

Import `RiotClient` and call any of the four public view model methods:

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
```

## CLI Usage

The package includes the `riotclient` binary.

```bash
riotclient whoami
riotclient owned-items --language en-US --pretty
riotclient loadout
riotclient wallet
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

## Token Host Rule

Access tokens and entitlements JWTs are strictly scoped. They may only ever be sent to hosts matching `*.pvp.net`, `*.riotgames.com`, or loopback `127.0.0.1`. The HTTP gateway enforces this policy and throws a `ForbiddenHostError` before sending any request that would transmit credentials to an unauthorized host. Requests to public endpoints such as `valorant-api.com` never carry authorization headers.

## What It Does Not Do

- No store purchases or transactional operations
- No automation, bots, or match orchestration
- No writing or mutating equipped loadouts
- No telemetry or credential logging

## Disclaimer

This project is an unofficial tool and is not endorsed by, directly affiliated with, maintained, authorized, or sponsored by Riot Games, Inc. VALORANT and all related properties are trademarks or registered trademarks of Riot Games, Inc.
