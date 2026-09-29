# Account

The `account` namespace provides access to the signed-in player identity, owned weapon skins, loadouts, wallet currencies, XP progression, agent contracts, favourites, client config, and game settings.

## Methods

### whoami

Retrieves profile identity, display name, tagLine, and server shard for the authenticated player.
Use this to identify the local account and confirm the connection is active.

```ts
const player = await client.account.whoami();
console.log(player);
```

```bash
riotclient whoami
```

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

### ownedItems

Returns the complete inventory of owned weapons, skin levels, chromas, buddies, player cards, sprays, and agents.
Names and asset URLs are enriched using the local catalogue for the specified language.

```ts
const items = await client.account.ownedItems({ language: "en-US" });
console.log(items.weapons);
```

```bash
riotclient owned-items --language en-US
```

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
  "language": "en-US",
  "weapons": [
    {
      "uuid": "ee61337c-4ab5-9b0f-3f90-46347473887c",
      "name": "Vandal",
      "category": "EEquippableCategory::Rifle",
      "skinsOwned": 12,
      "skinsTotal": 74
    }
  ]
}
```

### loadout

Fetches the currently equipped weapon cosmetics, buddies, player card, title, sprays, and incognito status.
Equipped item details include weapon and skin UUIDs resolved against the catalogue.

```ts
const loadout = await client.account.loadout();
console.log(loadout.guns);
```

```bash
riotclient loadout
```

```json
{
  "guns": [
    {
      "weapon": { "uuid": "ee61337c-4ab5-9b0f-3f90-46347473887c", "name": "Vandal" },
      "skin": {
        "uuid": "8908f237-47b2-031a-e905-1a89c93cc8f5",
        "name": "Prime Vandal",
        "icon": "https://media.valorant-api.com/weaponskinlevels/7209796e-4f76-88c9-04fa-fb81498b5e9d/displayicon.png"
      },
      "level": { "uuid": "7209796e-4f76-88c9-04fa-fb81498b5e9d", "name": "Level 4" },
      "chroma": { "uuid": "f90dfcb8-48dc-5db5-6490-67bb26ca9d9a", "name": "Prime Vandal (Variant 1 Orange)" },
      "buddy": null
    }
  ],
  "incognito": false
}
```

### equip

Equips specified skins, chromas, buddies, sprays, cards, titles, or incognito preferences.
Input changes are validated locally against your inventory before any payload is sent.

```ts
const updated = await client.account.equip({
  guns: [
    { weapon: "Vandal", skin: "Prime Vandal" }
  ],
  incognito: true
});
```

```bash
riotclient equip --gun Vandal="Prime Vandal" --incognito on --yes
```

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
  "incognito": true
}
```

### equipCollection

Equips a list of weapon skin UUIDs across all matching weapons in one operation.
Each skin is equipped with its highest unlocked level and base variant.

```ts
const skinUuids = ["8908f237-47b2-031a-e905-1a89c93cc8f5"];
const loadout = await client.account.equipCollection(skinUuids);
```

```bash
riotclient equip-collection 8908f237-47b2-031a-e905-1a89c93cc8f5 --yes
```

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
  "guns": []
}
```

### wallet

Inspects current balances for Valorant Points, Radianite Points, and Kingdom Credits.
Amounts reflect real-time wallet balances stored in the Riot PVP billing service.

```ts
const wallet = await client.account.wallet();
console.log(wallet.valorantPoints, wallet.radianite, wallet.kingdomCredits);
```

```bash
riotclient wallet
```

```json
{
  "valorantPoints": 1775,
  "radianite": 80,
  "kingdomCredits": 10000
}
```

### xp

Returns your account progression level, current unspent XP, and recent match experience history.
Recent history includes timestamps, level deltas, and breakdown of win and first-win bonuses.

```ts
const xp = await client.account.xp();
console.log(xp.level, xp.xp);
```

```bash
riotclient xp
```

```json
{
  "level": 128,
  "xp": 34500,
  "history": [
    {
      "matchId": "c9284241-1234-5678-9abc-def012345678",
      "at": "2026-09-27T12:00:00.000Z",
      "before": { "level": 128, "xp": 31500 },
      "after": { "level": 128, "xp": 34500 },
      "delta": 3000
    }
  ],
  "nextFirstWinAt": null
}
```

### contracts

Lists progression across all agent contracts, battlepasses, and seasonal event passes.
Each entry reports the tier reached, XP progress toward next tier, and unlocked rewards.

```ts
const contracts = await client.account.contracts();
console.log(contracts);
```

```bash
riotclient contracts
```

```json
[
  {
    "uuid": "45d176ab-40f0-4032-9cb7-7ff769d67b2d",
    "name": "Jett",
    "kind": "agent",
    "level": 10,
    "progress": 0,
    "nextLevelAt": null,
    "active": true,
    "rewards": []
  }
]
```

### missions

Fetches daily and weekly missions currently available to complete for XP and Kingdom Credits.
Includes progress count, completion status, and expiration timestamps.

```ts
const missions = await client.account.missions();
console.log(missions);
```

```bash
riotclient missions
```

```json
[
  {
    "uuid": "806a3500-47b9-8e47-e160-5a8286a1175c",
    "title": "Play games",
    "progress": 2,
    "target": 10,
    "complete": false,
    "expiresAt": "2026-10-01T00:00:00.000Z"
  }
]
```

### activateContract

Activates an agent contract to direct incoming match XP toward unlocking agent tiers.
Validation verifies that the contract belongs to an unowned agent and is not already active.

```ts
const contracts = await client.account.activateContract("45d176ab-40f0-4032-9cb7-7ff769d67b2d");
```

```bash
riotclient contract-activate 45d176ab-40f0-4032-9cb7-7ff769d67b2d --yes
```

```json
[
  {
    "uuid": "45d176ab-40f0-4032-9cb7-7ff769d67b2d",
    "name": "Jett",
    "kind": "agent",
    "level": 6,
    "progress": 15000,
    "nextLevelAt": 25000,
    "active": true,
    "rewards": []
  }
]
```

### penalties

Retrieves active penalties and restrictions applied to the player account.
Returns empty array when account is in good standing with zero restrictions.

```ts
const penalties = await client.account.penalties();
console.log(penalties);
```

```bash
riotclient penalties
```

```json
[]
```

### favourites

Fetches the list of weapon skins marked as favourite for the random skin rotator.
Returns skin UUIDs, item names, and associated weapon categories.

```ts
const favs = await client.account.favourites();
console.log(favs);
```

```bash
riotclient favourites
```

```json
[
  {
    "skinUuid": "8908f237-47b2-031a-e905-1a89c93cc8f5",
    "name": "Prime Vandal",
    "weapon": "Vandal"
  }
]
```

### addFavourite

Adds a weapon skin to your favourites list.
Validation confirms the item is owned in inventory and is not already favourited.

```ts
await client.account.addFavourite("8908f237-47b2-031a-e905-1a89c93cc8f5");
```

```bash
riotclient favourite-add 8908f237-47b2-031a-e905-1a89c93cc8f5 --yes
```

```json
[
  {
    "skinUuid": "8908f237-47b2-031a-e905-1a89c93cc8f5",
    "name": "Prime Vandal",
    "weapon": "Vandal"
  }
]
```

### removeFavourite

Removes a weapon skin from your favourites list.
Validation ensures the skin is currently marked as favourite.

```ts
await client.account.removeFavourite("8908f237-47b2-031a-e905-1a89c93cc8f5");
```

```bash
riotclient favourite-remove 8908f237-47b2-031a-e905-1a89c93cc8f5 --yes
```

```json
[]
```

### setActRankBadgeHidden

Toggles the public visibility of your competitive act rank badge on player cards.
Returns the updated boolean flag.

```ts
await client.account.setActRankBadgeHidden(true);
```

```bash
riotclient privacy --badge off
```

```json
true
```

### setLeaderboardAnonymized

Hides or reveals your display name on the global competitive leaderboard.
When enabled, your entry appears as Secret Agent on public standings.

```ts
await client.account.setLeaderboardAnonymized(true);
```

```bash
riotclient privacy --leaderboard off
```

```json
true
```

### session

Inspects the current game session loop status, client version, and playtime duration.
Tracks whether the player is in menus, matchmaking, or in-game.

```ts
const session = await client.account.session();
console.log(session.state, session.playtimeMinutes);
```

```bash
riotclient session
```

```json
{
  "state": "INGAME",
  "clientVersion": "release-09.06-shipping-15-2882269",
  "playtimeMinutes": 45,
  "restricted": false
}
```

### config

Prints the client configuration map resolved from the Riot services endpoints.
Contains host mappings, ports, and discovery targets for game features.

```ts
const config = await client.account.config();
console.log(config);
```

```bash
riotclient config
```

```json
{
  "chat.host": "us-1.chat.si.riotgames.com",
  "chat.port": 5223
}
```

### settings

Fetches player keybindings, mouse sensitivity, and crosshair configuration from the cloud.
Requires VALORANT to be running so the local remoting token can read the configuration.

```ts
const settings = await client.account.settings();
console.log(settings.mouse.sensitivity);
```

```bash
riotclient settings
```

```json
{
  "binds": [
    {
      "command": "PrimaryFire",
      "key": "LeftMouseButton",
      "alt": false,
      "ctrl": false,
      "shift": false,
      "agent": null,
      "slot": 0
    }
  ],
  "mouse": {
    "sensitivity": 0.35,
    "scopedSensitivityMultiplier": 1,
    "invertY": false,
    "rawInputBuffer": true
  },
  "raw": {}
}
```

### saveSettings

Writes modified keybindings and settings back to the Riot cloud settings store.
Requires explicit confirmation `{ confirm: true }` in code or `--confirm` in the CLI.

```ts
const settings = await client.account.settings();
settings.mouse.sensitivity = 0.40;
await client.account.saveSettings(settings, { confirm: true });
```

```bash
riotclient settings-save settings.json --yes --confirm
```

```json
{
  "binds": [],
  "mouse": {
    "sensitivity": 0.4,
    "scopedSensitivityMultiplier": 1,
    "invertY": false,
    "rawInputBuffer": true
  },
  "raw": {}
}
```

### client

Reads client locale, region, active Riot ID, and checks if VALORANT is actively running.
Useful for diagnostic health checks before launching workflows that need the game client.

```ts
const info = await client.account.client();
console.log(info.valorantRunning, info.region);
```

```bash
riotclient client
```

```json
{
  "locale": "en_US",
  "region": "na",
  "riotId": {
    "gameName": "Player",
    "tagLine": "NA1"
  },
  "valorantRunning": true,
  "valorantVersion": "release-09.06",
  "patchline": "live"
}
```
