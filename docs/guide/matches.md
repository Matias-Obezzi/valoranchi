# Matches

The `matches` namespace covers match history, detailed post-match scoreboards, competitive MMR ratings, rank history, live lobby detection, agent selection, dodging, and match abandonment.

## Methods

### list

Returns recent match history summaries for the authenticated player.
Results include match IDs, timestamps, queue types, and map identities.

```ts
const summaries = await client.matches.list({ count: 5, queue: "competitive" });
console.log(summaries);
```

```bash
riotclient matches --count 5 --queue competitive
```

```json
[
  {
    "id": "c9284241-1234-5678-9abc-def012345678",
    "startedAt": "2026-09-27T10:30:00.000Z",
    "queue": "competitive",
    "map": {
      "uuid": "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319",
      "name": "Ascent",
      "path": "/Game/Maps/Ascent/Ascent"
    }
  }
]
```

### get

Retrieves complete post-match statistics for a match ID, including player scoreboards, rounds, kills, and team scores.
Player agents, ranks, weapons, and damage breakdowns are fully resolved.

```ts
const match = await client.matches.get("c9284241-1234-5678-9abc-def012345678");
console.log(match.teams, match.players.length);
```

```bash
riotclient match c9284241-1234-5678-9abc-def012345678
```

```json
{
  "id": "c9284241-1234-5678-9abc-def012345678",
  "startedAt": "2026-09-27T10:30:00.000Z",
  "lengthMs": 1845000,
  "completed": true,
  "queue": "competitive",
  "ranked": true,
  "custom": false,
  "customName": null,
  "map": {
    "uuid": "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319",
    "name": "Ascent",
    "path": "/Game/Maps/Ascent/Ascent"
  },
  "mode": "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C",
  "season": {
    "uuid": "e23c0b4e-4e4c-1e24-4f1a-b6b47c0b2b8e",
    "name": "Episode 9 Act 2"
  },
  "teams": [
    { "id": "Blue", "won": true, "roundsWon": 13, "roundsPlayed": 22 },
    { "id": "Red", "won": false, "roundsWon": 9, "roundsPlayed": 22 }
  ],
  "players": [],
  "rounds": [],
  "self": { "team": "Blue", "won": true },
  "replayRecorded": false
}
```

### mmr

Fetches competitive MMR details, including current rank tier, ranking rating (RR), peak rank, and last match rating delta.
Provides act win summaries and indicates whether your name is hidden on leaderboards.

```ts
const mmr = await client.matches.mmr();
console.log(mmr.current?.name, mmr.current?.rating);
```

```bash
riotclient mmr --pretty
```

```json
{
  "current": {
    "tier": 17,
    "name": "Diamond 3",
    "division": "3",
    "icon": "https://media.valorant-api.com/competitivetiers/03621f52-4cd8-5e5e-4318-00a25e1144cd/17/largeicon.png",
    "rating": 45
  },
  "peak": {
    "tier": 18,
    "name": "Ascendant 1",
    "division": "1",
    "icon": "https://media.valorant-api.com/competitivetiers/03621f52-4cd8-5e5e-4318-00a25e1144cd/18/largeicon.png",
    "rating": 12,
    "act": {
      "uuid": "e23c0b4e-4e4c-1e24-4f1a-b6b47c0b2b8e",
      "name": "Episode 9 Act 1"
    }
  },
  "act": {
    "uuid": "e23c0b4e-4e4c-1e24-4f1a-b6b47c0b2b8e",
    "name": "Episode 9 Act 2",
    "games": 18,
    "wins": 11,
    "gamesNeededForRating": 0
  },
  "lastUpdate": {
    "matchId": "c9284241-1234-5678-9abc-def012345678",
    "at": "2026-09-27T11:15:00.000Z",
    "before": { "tier": 17, "name": "Diamond 3", "division": "3", "icon": null, "rating": 26 },
    "after": { "tier": 17, "name": "Diamond 3", "division": "3", "icon": null, "rating": 45 },
    "earned": 19,
    "movement": "up"
  },
  "leaderboardAnonymized": false
}
```

### rankHistory

Returns chronological competitive rating updates, tier promotions, demotions, and performance bonuses.
Useful for tracking rank trajectory across recent ranked games.

```ts
const history = await client.matches.rankHistory({ count: 5 });
console.log(history);
```

```bash
riotclient rank-history --count 5
```

```json
[
  {
    "matchId": "c9284241-1234-5678-9abc-def012345678",
    "at": "2026-09-27T11:15:00.000Z",
    "map": { "name": "Ascent", "path": "/Game/Maps/Ascent/Ascent" },
    "before": { "tier": 17, "name": "Diamond 3", "division": "3", "icon": null, "rating": 26 },
    "after": { "tier": 17, "name": "Diamond 3", "division": "3", "icon": null, "rating": 45 },
    "earned": 19,
    "bonus": 2,
    "movement": "up",
    "afkPenalty": 0
  }
]
```

### live

Inspects active pregame agent select, in-game match lobbies, or practice range sessions.
Can optionally enrich allies and enemies with their competitive ranks and weapon skins.

```ts
const live = await client.matches.live({ ranks: true });
console.log(live.phase);
```

```bash
riotclient live --ranks --pretty
```

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

### listFor

Retrieves match history summaries for another player specified by PUUID.
Operates identically to `list`, scoped to any target player account.

```ts
const summaries = await client.matches.listFor("4a7b9c1d-1234-5678-9abc-def012345678", { count: 3 });
console.log(summaries);
```

```bash
riotclient matches-for 4a7b9c1d-1234-5678-9abc-def012345678 --count 3
```

```json
[
  {
    "id": "c9284241-1234-5678-9abc-def012345678",
    "startedAt": "2026-09-27T10:30:00.000Z",
    "queue": "competitive",
    "map": {
      "uuid": "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319",
      "name": "Ascent",
      "path": "/Game/Maps/Ascent/Ascent"
    }
  }
]
```

### mmrFor

Inspects competitive MMR, current tier, and peak rating for any player by PUUID.
Allows looking up ranks of teammates or lobby participants.

```ts
const mmr = await client.matches.mmrFor("4a7b9c1d-1234-5678-9abc-def012345678");
console.log(mmr.current?.name);
```

```bash
riotclient mmr-for 4a7b9c1d-1234-5678-9abc-def012345678
```

```json
{
  "current": {
    "tier": 17,
    "name": "Diamond 3",
    "division": "3",
    "icon": "https://media.valorant-api.com/competitivetiers/03621f52-4cd8-5e5e-4318-00a25e1144cd/17/largeicon.png",
    "rating": 45
  },
  "peak": null,
  "act": null,
  "lastUpdate": null,
  "leaderboardAnonymized": false
}
```

### rankHistoryFor

Fetches competitive rating updates and tier movements for another player by PUUID.
Returns chronological rating changes recorded for that player account.

```ts
const history = await client.matches.rankHistoryFor("4a7b9c1d-1234-5678-9abc-def012345678");
console.log(history);
```

```bash
riotclient rank-history-for 4a7b9c1d-1234-5678-9abc-def012345678
```

```json
[
  {
    "matchId": "c9284241-1234-5678-9abc-def012345678",
    "at": "2026-09-27T11:15:00.000Z",
    "map": { "name": "Ascent", "path": "/Game/Maps/Ascent/Ascent" },
    "before": { "tier": 17, "name": "Diamond 3", "division": "3", "icon": null, "rating": 26 },
    "after": { "tier": 17, "name": "Diamond 3", "division": "3", "icon": null, "rating": 45 },
    "earned": 19,
    "bonus": 2,
    "movement": "up",
    "afkPenalty": 0
  }
]
```

### leaderboard

Queries the regional competitive leaderboard for Radiant and Immortal tiers.
Supports pagination by start offset, page size, and player search filters.

```ts
const board = await client.matches.leaderboard({ size: 10 });
console.log(board.entries);
```

```bash
riotclient leaderboard --size 10
```

```json
{
  "season": "e23c0b4e-4e4c-1e24-4f1a-b6b47c0b2b8e",
  "total": 15000,
  "entries": [
    {
      "rank": 1,
      "puuid": "11111111-2222-3333-4444-555555555555",
      "gameName": "TopPlayer",
      "tagLine": "111",
      "anonymized": false,
      "banned": false,
      "rating": 890,
      "wins": 142,
      "tier": {
        "tier": 27,
        "name": "Radiant",
        "division": null,
        "icon": null,
        "rating": null
      }
    }
  ],
  "tierThresholds": {
    "24": 0,
    "27": 450
  }
}
```

### content

Returns active act and episode metadata, along with scheduled in-game seasonal events.
Reports start dates, end dates, and active flags.

```ts
const content = await client.matches.content();
console.log(content.act?.name);
```

```bash
riotclient content
```

```json
{
  "act": {
    "id": "e23c0b4e-4e4c-1e24-4f1a-b6b47c0b2b8e",
    "name": "Episode 9 Act 2",
    "isActive": true,
    "startsAt": "2026-08-28T00:00:00.000Z",
    "endsAt": "2026-10-23T00:00:00.000Z"
  },
  "episode": {
    "id": "f34d1c5f-5f5d-2f35-502b-c7c58d1c3c9f",
    "name": "Episode 9",
    "isActive": true,
    "startsAt": "2026-06-25T00:00:00.000Z",
    "endsAt": "2027-01-08T00:00:00.000Z"
  },
  "events": []
}
```

### premier

Retrieves the player's Premier eligibility, team roster, season schedule, and conference placement.
Returns null sections when the player has not enrolled in a Premier team.

```ts
const premier = await client.matches.premier();
console.log(premier.eligible);
```

```bash
riotclient premier
```

```json
{
  "eligible": true,
  "roster": null,
  "season": null,
  "conferences": null
}
```

### selectAgent

Highlights an agent during the pregame agent selection phase without locking in.
Validation confirms pregame lobby state and verifies that the agent is unlocked.

```ts
await client.matches.selectAgent("Jett");
```

```bash
riotclient agent-select "Jett" --yes
```

```json
{
  "phase": "pregame",
  "matchId": "c9284241-1234-5678-9abc-def012345678",
  "queue": "competitive",
  "ranked": true,
  "map": { "uuid": null, "name": "Ascent", "path": "/Game/Maps/Ascent/Ascent" },
  "mode": null,
  "phaseEndsInMs": 45000,
  "allies": [],
  "enemies": [],
  "self": null
}
```

### lockAgent

Locks in an agent during pregame agent selection.
Validation ensures no teammate has already locked the requested agent.

```ts
await client.matches.lockAgent("Jett");
```

```bash
riotclient agent-lock "Jett" --yes
```

```json
{
  "phase": "pregame",
  "matchId": "c9284241-1234-5678-9abc-def012345678",
  "queue": "competitive",
  "ranked": true,
  "map": { "uuid": null, "name": "Ascent", "path": "/Game/Maps/Ascent/Ascent" },
  "mode": null,
  "phaseEndsInMs": 30000,
  "allies": [],
  "enemies": [],
  "self": null
}
```

### dodge

Aborts the pregame agent selection lobby to avoid playing the match.
Requires explicit confirmation (`{ confirm: true }` in code, or `--yes --confirm` in CLI).

```ts
await client.matches.dodge({ confirm: true });
```

```bash
riotclient dodge --yes --confirm
```

```json
{
  "dodged": true,
  "matchId": "c9284241-1234-5678-9abc-def012345678"
}
```

### leaveMatch

Quits an active in-game match session and returns player to the lobby.
Requires explicit confirmation (`{ confirm: true }` in code, or `--yes --confirm` in CLI).

```ts
await client.matches.leaveMatch({ confirm: true });
```

```bash
riotclient leave-match --yes --confirm
```

```json
{
  "left": true,
  "matchId": "c9284241-1234-5678-9abc-def012345678"
}
```
