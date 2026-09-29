# Party

The `party` namespace handles lobby state, party invitations, join requests, matchmaking queues, party accessibility, invite codes, and custom game configuration.

## Methods

### current

Inspects the active party, including member roster, readiness status, current queue, and invite code.
Returns null when the player is not currently in a party.

```ts
const party = await client.party.current();
console.log(party?.members.length);
```

```bash
riotclient party
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "open",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": [
    {
      "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
      "gameName": "Player",
      "tagLine": "NA1",
      "owner": true,
      "ready": true,
      "rank": {
        "tier": 17,
        "name": "Diamond 3",
        "division": "3",
        "icon": "https://media.valorant-api.com/competitivetiers/03621f52-4cd8-5e5e-4318-00a25e1144cd/17/largeicon.png",
        "rating": 45
      },
      "accountLevel": 128,
      "card": null,
      "title": null,
      "incognito": false
    }
  ]
}
```

### invite

Invites a player to join your party using their Riot ID (`Name#Tag`).
Validation confirms party ownership and checks that the party is in an idle state.

```ts
await client.party.invite("FriendTwo#NA1");
```

```bash
riotclient party-invite "FriendTwo#NA1" --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "open",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### kick

Removes a member from your party using their PUUID.
Owner-restricted action validated against active party membership.

```ts
await client.party.kick("5b8c0d2e-2345-6789-abcd-ef0123456789");
```

```bash
riotclient party-kick 5b8c0d2e-2345-6789-abcd-ef0123456789 --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "open",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### promote

Transfers party leadership to another existing party member by PUUID.
Caller must currently be the party owner and cannot target self.

```ts
await client.party.promote("5b8c0d2e-2345-6789-abcd-ef0123456789");
```

```bash
riotclient party-promote 5b8c0d2e-2345-6789-abcd-ef0123456789 --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "open",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### createInviteCode

Generates an alphanumeric party invite code that other players can use to join.
Permits party owners to share a temporary direct-join code.

```ts
const party = await client.party.createInviteCode();
console.log(party?.inviteCode);
```

```bash
riotclient party-code --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "open",
  "queue": "competitive",
  "inviteCode": "AB12CD",
  "queueEnteredAt": null,
  "members": []
}
```

### revokeInviteCode

Revokes the active alphanumeric invite code for your party.
Validation checks that an invite code is actively assigned before sending.

```ts
await client.party.revokeInviteCode();
```

```bash
riotclient party-code --revoke --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "open",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### joinByCode

Joins an existing party using a valid alphanumeric invite code.
Validation requires codes between 6 and 12 alphanumeric characters.

```ts
await client.party.joinByCode("AB12CD");
```

```bash
riotclient party-join AB12CD --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "open",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### setReady

Toggles your personal ready status in the active party.
Ready status is required for all members before party matchmaking can begin.

```ts
await client.party.setReady(true);
```

```bash
riotclient party-ready on --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "open",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### setQueue

Changes the matchmaking queue for your party (e.g. competitive, unrated, deathmatch).
Target queue is validated against active queue configurations and party size limits.

```ts
await client.party.setQueue("competitive");
```

```bash
riotclient party-queue competitive --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "open",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### setAccessibility

Updates party accessibility between `open` (friends can join freely) and `closed` (invite-only).
Owner-restricted command.

```ts
await client.party.setAccessibility("closed");
```

```bash
riotclient party-access closed --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "closed",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### startMatchmaking

Enters the party into the selected matchmaking queue.
Validation verifies that the party is idle, all members are ready, and no rank restrictions apply.

```ts
await client.party.startMatchmaking();
```

```bash
riotclient party-start --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "MATCHMAKING",
  "accessibility": "closed",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": "2026-09-29T12:00:00.000Z",
  "members": []
}
```

### stopMatchmaking

Cancels active matchmaking search and returns the party to idle state.
Validation confirms party is currently in matchmaking before sending request.

```ts
await client.party.stopMatchmaking();
```

```bash
riotclient party-stop --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "closed",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### leave

Leaves the current party and places player into a private solo party.
Can be executed by any non-solo member regardless of ownership.

```ts
await client.party.leave();
```

```bash
riotclient party-leave --yes
```

```json
{
  "id": "new-solo-party-id",
  "state": "DEFAULT",
  "accessibility": "closed",
  "queue": "unrated",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### queues

Fetches matchmaking queue configurations including team size, player limits, and ranked status.
Reports active rules for competitive, unrated, swiftplay, and deathmatch.

```ts
const queues = await client.party.queues();
console.log(queues);
```

```bash
riotclient queues
```

```json
[
  {
    "id": "competitive",
    "enabled": true,
    "ranked": true,
    "teamSize": 5,
    "minPartySize": 1,
    "maxPartySize": 5,
    "mode": "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C"
  }
]
```

### customGameConfigs

Retrieves enabled maps, game modes, and regional server pods available for custom games.
Supplies map names, server ping latencies, and valid mode identifiers.

```ts
const configs = await client.party.customGameConfigs();
console.log(configs.maps, configs.servers);
```

```bash
riotclient custom-game-configs
```

```json
{
  "maps": [
    { "path": "/Game/Maps/Ascent/Ascent", "name": "Ascent" }
  ],
  "modes": [
    { "path": "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C", "name": "Standard" }
  ],
  "servers": [
    { "id": "pdx", "name": "US West (Oregon)", "ping": 25 }
  ]
}
```

### join

Joins an active party using its internal party UUID.
Used to join open friend lobbies or accept direct party invites.

```ts
await client.party.join("b11d9f82-1234-5678-9abc-def012345678");
```

```bash
riotclient party-join b11d9f82-1234-5678-9abc-def012345678 --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "open",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### declineInvite

Declines an incoming party invitation by its invite ID.
Removes the invite from pending incoming invites.

```ts
await client.party.declineInvite("invite-uuid-1234");
```

```bash
riotclient party-decline-invite invite-uuid-1234 --yes
```

```json
{
  "declined": true,
  "inviteId": "invite-uuid-1234"
}
```

### requestToJoin

Sends a request to join a closed party given its party ID.
Party owner receives an incoming join request to approve or decline.

```ts
await client.party.requestToJoin("b11d9f82-1234-5678-9abc-def012345678");
```

```bash
riotclient party-request b11d9f82-1234-5678-9abc-def012345678 --yes
```

```json
{
  "requested": true,
  "partyId": "b11d9f82-1234-5678-9abc-def012345678"
}
```

### declineRequest

Declines an incoming party join request submitted by another player.
Only party owners can review and decline join requests.

```ts
await client.party.declineRequest("request-uuid-1234");
```

```bash
riotclient party-decline-request request-uuid-1234 --yes
```

```json
{
  "declined": true,
  "requestId": "request-uuid-1234"
}
```

### invites

Lists all incoming party invites currently addressed to the player.
Returns inviting player profile, source party ID, and arrival timestamp.

```ts
const invites = await client.party.invites();
console.log(invites);
```

```bash
riotclient party-invites
```

```json
[
  {
    "id": "invite-uuid-1234",
    "partyId": "b11d9f82-1234-5678-9abc-def012345678",
    "from": {
      "puuid": "5b8c0d2e-2345-6789-abcd-ef0123456789",
      "gameName": "Inviter",
      "tagLine": "NA1"
    },
    "at": "2026-09-29T12:00:00.000Z"
  }
]
```

### requests

Lists all pending join requests submitted to your party.
Allows party leaders to review waiting applicants.

```ts
const requests = await client.party.requests();
console.log(requests);
```

```bash
riotclient party-requests
```

```json
[
  {
    "id": "request-uuid-1234",
    "from": {
      "puuid": "5b8c0d2e-2345-6789-abcd-ef0123456789",
      "gameName": "Requester",
      "tagLine": "NA1"
    },
    "at": "2026-09-29T12:00:00.000Z"
  }
]
```

### makeCustomGame

Converts the active party into a custom game lobby.
Enables map selection, mode selection, cheats, and custom game rules.

```ts
await client.party.makeCustomGame();
```

```bash
riotclient custom-game --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "CUSTOM_GAME_SETUP",
  "accessibility": "closed",
  "queue": null,
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### makeDefault

Switches a custom game party back to standard matchmaking lobby mode.
Restores the default matchmaking state for standard queues.

```ts
await client.party.makeDefault("competitive");
```

```bash
riotclient party-default competitive --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "closed",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### setCustomGameSettings

Applies custom game rules, map choice, mode choice, and server pod selection.
Validation checks that the requested map and mode are enabled in custom game configurations.

```ts
await client.party.setCustomGameSettings({
  map: "Ascent",
  mode: "Standard",
  server: "pdx",
  rules: { AllowGameModifiers: true },
});
```

```bash
riotclient custom-game-settings --map Ascent --mode Standard --server pdx --rule AllowGameModifiers=true --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "CUSTOM_GAME_SETUP",
  "accessibility": "closed",
  "queue": null,
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### setTeam

Assigns a party member to a specific custom game team (`TeamOne`, `TeamTwo`, or `TeamSpectate`).
Requires party to be in custom game setup state.

```ts
await client.party.setTeam("4a7b9c1d-1234-5678-9abc-def012345678", "TeamOne");
```

```bash
riotclient custom-game-team 4a7b9c1d-1234-5678-9abc-def012345678 TeamOne --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "CUSTOM_GAME_SETUP",
  "accessibility": "closed",
  "queue": null,
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### startCustomGame

Launches the custom game match with currently assigned teams and settings.
Validation checks that players are present on TeamOne or TeamTwo.

```ts
await client.party.startCustomGame();
```

```bash
riotclient custom-game-start --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "STARTING_CUSTOM_GAME",
  "accessibility": "closed",
  "queue": null,
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### balanceTeams

Automatically balances players across TeamOne and TeamTwo based on MMR.
Party owner command validated in custom game setup mode.

```ts
await client.party.balanceTeams();
```

```bash
riotclient custom-game-balance --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "CUSTOM_GAME_SETUP",
  "accessibility": "closed",
  "queue": null,
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### setPreferredServers

Configures prioritized game server pods for party matchmaking.
Validation verifies that each server pod ID exists in the game server ping index.

```ts
await client.party.setPreferredServers(["pdx", "sjc"]);
```

```bash
riotclient party-servers pdx,sjc --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "closed",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### setModerator

Toggles tournament moderator privileges for a custom game participant by PUUID.
Moderators can pause and manage game rules during tournament play.

```ts
await client.party.setModerator("5b8c0d2e-2345-6789-abcd-ef0123456789", true);
```

```bash
riotclient party-moderator 5b8c0d2e-2345-6789-abcd-ef0123456789 on --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "CUSTOM_GAME_SETUP",
  "accessibility": "closed",
  "queue": null,
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```

### refresh

Refreshes party member pings and synchronization state with Riot services.
Forces loopback state updates across active lobby members.

```ts
await client.party.refresh();
```

```bash
riotclient party-refresh --yes
```

```json
{
  "id": "b11d9f82-1234-5678-9abc-def012345678",
  "state": "DEFAULT",
  "accessibility": "closed",
  "queue": "competitive",
  "inviteCode": null,
  "queueEnteredAt": null,
  "members": []
}
```
