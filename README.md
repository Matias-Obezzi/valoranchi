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

// 9. Get recent match history summaries
const matchSummaries = await client.matches({ count: 5, queue: "competitive" });
console.log(matchSummaries);

// 10. Get full match details by match ID
if (matchSummaries.length > 0) {
  const match = await client.match(matchSummaries[0].id);
  console.log(match);
}

// 11. Get competitive MMR breakdown and current rank
const mmr = await client.mmr();
console.log(mmr);

// 12. Get rank change history (competitive rating updates)
const rankChanges = await client.rankHistory({ count: 5 });
console.log(rankChanges);

// 13. Get live match state (pregame agent select, in-game, range, or none)
const live = await client.liveMatch({ ranks: true });
console.log(live);

// 14. Get current party details and members
const party = await client.party();
console.log(party);

// Close the local loopback client agent when finished
await client.close();
```

## Real-Time Events

Subscribe to live events emitted by the local Riot Client WebSocket: friend presence updates, friend requests, roster changes, chat messages, party changes, and game transitions (agent select, match start).

Events come from the local Riot Client loopback connection only and carry no authentication tokens.

### Node Example

```ts
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient();
const events = client.events();

events.on("connected", () => console.log("Connected to Riot Client"));
events.on("disconnected", () => console.log("Disconnected"));

events.on("friend:presence", ({ friend, change }) => {
  console.log(`Friend ${friend.gameName} is now ${change} (${friend.presence.state})`);
});

events.on("message", (msg) => {
  console.log(`[${msg.from.gameName}]: ${msg.body}`);
});

events.on("game", ({ phase, matchId }) => {
  console.log(`Game phase: ${phase} (match ${matchId})`);
});

// Stop listening and close the local socket when finished
await client.close();
```

### CLI Command

Stream live events formatted as one JSON object per line until interrupted:

```bash
riotclient watch
riotclient watch --only friend:presence,message,game
riotclient watch --raw
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
riotclient matches --count 5
riotclient match <match-id>
riotclient mmr --pretty
riotclient rank-history --count 5
riotclient live --ranks
riotclient party
riotclient watch
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

Example trimmed output from `riotclient live --ranks --pretty`:

```json
{
  "phase": "ingame",
  "matchId": "c9284241-1234-5678-9abc-def012345678",
  "queue": "competitive",
  "ranked": true,
  "map": {
    "uuid": "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319",
    "name": "Ascent",
    "path": "/Game/Maps/Ascent/Ascent"
  },
  "mode": "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C",
  "phaseEndsInMs": null,
  "allies": [
    {
      "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
      "gameName": "Player",
      "tagLine": "NA1",
      "incognito": false,
      "team": "Blue",
      "agent": {
        "uuid": "add6443a-41bd-e414-f6ad-e58d267f4e95",
        "name": "Jett",
        "icon": "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png",
        "role": "Duelist"
      },
      "selection": "locked",
      "accountLevel": 128,
      "rank": {
        "tier": 17,
        "name": "Diamond 3",
        "division": "3",
        "icon": "https://media.valorant-api.com/competitivetiers/03621f52-4cd8-5e5e-4318-00a25e1144cd/17/largeicon.png",
        "rating": 45
      }
    }
  ],
  "enemies": [],
  "self": {
    "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
    "gameName": "Player",
    "tagLine": "NA1",
    "incognito": false,
    "team": "Blue",
    "agent": {
      "uuid": "add6443a-41bd-e414-f6ad-e58d267f4e95",
      "name": "Jett",
      "icon": "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png",
      "role": "Duelist"
    },
    "selection": "locked",
    "accountLevel": 128,
    "rank": {
      "tier": 17,
      "name": "Diamond 3",
      "division": "3",
      "icon": "https://media.valorant-api.com/competitivetiers/03621f52-4cd8-5e5e-4318-00a25e1144cd/17/largeicon.png",
      "rating": 45
    }
  }
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
- `6`: Local validation failed (`VALIDATION`)
- `1`: Unexpected failure

On failure, error information is formatted as `{ "error": { "code": string, "message": string, "reason"?: string, "details"?: object } }` and output to stderr.

## Writes

All writes are validated locally against your inventory and catalogue before any network request reaches Riot. If an item is not owned, an instance is exhausted, a weapon mismatches, or a social target is invalid, a `ValidationError` is thrown immediately and no network request is sent.

### Available Methods

- `client.equip(change: LoadoutChange): Promise<Loadout>`: Update equipped skins, skin levels, chromas, buddies, sprays, player card, title, level border, and incognito status.
- `client.equipCollection(skinUuids: string[]): Promise<Loadout>`: Equip a list of skin UUIDs (one per weapon) at their highest owned level and base chroma.
- `client.sendMessage(to, text): Promise<Message>`: Send a whisper or room message (target can be `{ puuid }`, `{ conversationId }`, or `{ riotId }`).
- `client.sendFriendRequest(riotId): Promise<FriendRequest[]>`: Send a friend request by `Name#Tag`.
- `client.acceptFriendRequest(puuid): Promise<Friend[]>`: Accept an incoming friend request.
- `client.declineFriendRequest(puuid): Promise<FriendRequest[]>`: Decline an incoming friend request.
- `client.cancelFriendRequest(puuid): Promise<FriendRequest[]>`: Cancel an outgoing friend request.
- `client.removeFriend(puuid): Promise<Friend[]>`: Remove a friend.
- `client.blockPlayer(target): Promise<BlockedPlayer[]>`: Block a player by PUUID or `Name#Tag`.
- `client.unblockPlayer(puuid): Promise<BlockedPlayer[]>`: Unblock a player.
- `client.invite(riotId): Promise<Party>`: Invite a player to the party by `Name#Tag`.
- `client.kick(puuid): Promise<Party>`: Remove a member from the party (owner only).
- `client.promote(puuid): Promise<Party>`: Transfer party ownership to another member.
- `client.createInviteCode(): Promise<Party>`: Generate an invite code for the party.
- `client.revokeInviteCode(): Promise<Party>`: Revoke the party's current invite code.
- `client.joinByCode(code): Promise<Party>`: Join a party using an alphanumeric invite code.
- `client.setReady(ready): Promise<Party>`: Set your ready status (`true` or `false`).
- `client.setQueue(queue): Promise<Party>`: Change party queue (validated against eligible queues).
- `client.setAccessibility(accessibility): Promise<Party>`: Set party accessibility (`"open"` or `"closed"`).
- `client.startMatchmaking(): Promise<Party>`: Enter matchmaking queue (requires all members ready and idle party).
- `client.stopMatchmaking(): Promise<Party>`: Cancel matchmaking queue.
- `client.leave(): Promise<Party>`: Leave your current party.

### Party Validation Rules

Every party write is validated against the live party state before any request reaches Riot:

- `no-party`: Thrown when outside the client or the player has no active party.
- `not-owner`: Thrown when a non-owner attempts owner-restricted actions (`kick`, `promote`, `set-queue`, `set-accessibility`, `create-invite-code`, `revoke-invite-code`, `start-matchmaking`, `stop-matchmaking`).
- `not-a-member`: Thrown when caller is not in party, or when the kick/promote target is not in the party.
- `self-target`: Thrown when attempting to kick or promote yourself.
- `already-in-party`: Thrown when joining by code for a party the caller already belongs to.
- `queue-not-eligible`: Thrown when selecting a queue not present in `EligibleQueues`.
- `queue-restricted`: Thrown on matchmaking join when party has active queue ineligibilities.
- `party-not-idle`: Thrown when changing queue, inviting, changing accessibility, or joining matchmaking while party state is not `DEFAULT`.
- `not-matchmaking`: Thrown when stopping matchmaking while party state is not `MATCHMAKING`.
- `members-not-ready`: Thrown on matchmaking join when any party member has not set ready.
- `invalid-riot-id`: Thrown when inviting with a malformed `Name#Tag`.
- `invalid-code`: Thrown when invite code is not 6 to 12 alphanumeric characters.
- `invite-code-missing`: Thrown when revoking an invite code but none is active.
- `restricted`: Thrown on matchmaking join when party has active restriction penalty seconds.

### Dry-Run by Default in CLI

In the CLI, every write command defaults to a **dry run**: it validates the operation locally, outputs the validated body (tokens excluded) as JSON to stdout, and exits 0 without executing any network mutations.

Pass `--yes` to execute the actual write:

```bash
# Dry run: validates locally and prints the PUT body without sending
riotclient equip --card 0819fbcd-4bd4-c379-5384-52803440f2b2

# Execute the write
riotclient equip --card 0819fbcd-4bd4-c379-5384-52803440f2b2 --yes
```

If validation fails, the command exits with code `6` and writes the validation error to stderr:

```json
{
  "error": {
    "code": "VALIDATION",
    "reason": "card-not-owned",
    "message": "Card is not owned",
    "details": { "card": "00000000-0000-0000-0000-000000000000" }
  }
}
```

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

- No store purchases, radianite upgrades, or transactional operations
- No automation, bots, or match orchestration
- No custom games, tournaments, or premier orchestration
- No telemetry or credential logging

## Disclaimer

This project is an unofficial tool and is not endorsed by, directly affiliated with, maintained, authorized, or sponsored by Riot Games, Inc. VALORANT and all related properties are trademarks or registered trademarks of Riot Games, Inc.
