# Social

The `social` namespace manages friends, real-time presence status, incoming and outgoing friend requests, chat conversations, whispers, room messages, participants, and blocklists.

## Methods

### friends

Returns your friends roster together with rich presence, current state, active party, and rank.
Presence states include menus, pregame agent select, in-game matches, away, and offline.

```ts
const friends = await client.social.friends();
console.log(friends);
```

```bash
riotclient friends
```

```json
[
  {
    "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
    "gameName": "FriendOne",
    "tagLine": "NA1",
    "note": null,
    "group": "**Default",
    "region": "na",
    "lastOnline": null,
    "presence": {
      "state": "online",
      "product": "valorant",
      "since": "2026-09-29T12:00:00.000Z",
      "valorant": {
        "state": "menus",
        "queue": "competitive",
        "map": null,
        "party": {
          "id": "b11d9f82-1234-5678-9abc-def012345678",
          "size": 1,
          "max": 5,
          "owner": true
        },
        "competitiveTier": 17,
        "leaderboardPosition": 0,
        "accountLevel": 128,
        "card": null,
        "title": null,
        "score": null
      }
    }
  }
]
```

### friendRequests

Lists all pending friend requests, categorized as either incoming or outgoing.
Entries report the counterpart PUUID, game name, tagLine, and request direction.

```ts
const requests = await client.social.friendRequests();
console.log(requests);
```

```bash
riotclient friend-requests
```

```json
[
  {
    "puuid": "5b8c0d2e-2345-6789-abcd-ef0123456789",
    "gameName": "Applicant",
    "tagLine": "EUW",
    "direction": "incoming"
  }
]
```

### blocked

Returns the list of players currently blocked on your account.
Blocked players cannot send you whispers, invites, or friend requests.

```ts
const blocked = await client.social.blocked();
console.log(blocked);
```

```bash
riotclient blocked
```

```json
[
  {
    "puuid": "6c9d1e3f-3456-7890-bcde-f0123456789a",
    "gameName": "Troll",
    "tagLine": "NA1"
  }
]
```

### conversations

Fetches active chat threads, including 1-on-1 whispers, party rooms, and match channels.
Provides conversation IDs, unread message counters, and counterpart player profiles.

```ts
const conversations = await client.social.conversations();
console.log(conversations);
```

```bash
riotclient conversations
```

```json
[
  {
    "id": "4a7b9c1d-1234-5678-9abc-def012345678@us-1.chat.si.riotgames.com",
    "kind": "whisper",
    "unread": 0,
    "muted": false,
    "with": {
      "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
      "gameName": "FriendOne",
      "tagLine": "NA1"
    }
  }
]
```

### messages

Retrieves recent chat messages, optionally filtered by specific conversation ID.
Each message contains sender metadata, message body, read status, and ISO timestamp.

```ts
const messages = await client.social.messages("conversation-id");
console.log(messages);
```

```bash
riotclient messages --cid <conversation-id>
```

```json
[
  {
    "id": "1234567890",
    "conversationId": "4a7b9c1d-1234-5678-9abc-def012345678@us-1.chat.si.riotgames.com",
    "from": {
      "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
      "gameName": "FriendOne",
      "tagLine": "NA1"
    },
    "body": "Ready to queue?",
    "at": "2026-09-29T12:05:00.000Z",
    "read": true,
    "kind": "whisper"
  }
]
```

### sendMessage

Sends a chat message to a friend whisper, active party room, or match room.
Target recipient can be provided as a PUUID, Riot ID (`Name#Tag`), or conversation ID.

```ts
const msg = await client.social.sendMessage({ riotId: "FriendOne#NA1" }, "In game right now");
```

```bash
riotclient send --to "FriendOne#NA1" --text "In game right now" --yes
```

```json
{
  "id": "1234567891",
  "conversationId": "4a7b9c1d-1234-5678-9abc-def012345678@us-1.chat.si.riotgames.com",
  "from": {
    "puuid": "self-puuid",
    "gameName": "Player",
    "tagLine": "NA1"
  },
  "body": "In game right now",
  "at": "2026-09-29T12:06:00.000Z",
  "read": true,
  "kind": "whisper"
}
```

### sendFriendRequest

Sends an outgoing friend request to a player using their Riot ID (`Name#Tag`).
Validation ensures the format matches valid Riot ID syntax.

```ts
await client.social.sendFriendRequest("FriendTwo#NA1");
```

```bash
riotclient friend-request "FriendTwo#NA1" --yes
```

```json
[
  {
    "puuid": "7d0e2f4a-4567-8901-cdef-0123456789ab",
    "gameName": "FriendTwo",
    "tagLine": "NA1",
    "direction": "outgoing"
  }
]
```

### acceptFriendRequest

Accepts an incoming friend request identified by player PUUID.
Upon acceptance, the counterpart is moved to your friends roster.

```ts
await client.social.acceptFriendRequest("5b8c0d2e-2345-6789-abcd-ef0123456789");
```

```bash
riotclient friend-accept 5b8c0d2e-2345-6789-abcd-ef0123456789 --yes
```

```json
[
  {
    "puuid": "5b8c0d2e-2345-6789-abcd-ef0123456789",
    "gameName": "Applicant",
    "tagLine": "EUW",
    "group": "**Default",
    "region": "eu",
    "presence": {
      "state": "online",
      "product": "valorant",
      "since": null,
      "valorant": null
    }
  }
]
```

### declineFriendRequest

Declines an incoming friend request without blocking the player.
Removes the pending request from your incoming request roster.

```ts
await client.social.declineFriendRequest("5b8c0d2e-2345-6789-abcd-ef0123456789");
```

```bash
riotclient friend-decline 5b8c0d2e-2345-6789-abcd-ef0123456789 --yes
```

```json
[]
```

### cancelFriendRequest

Cancels an outgoing friend request previously sent to another player.
Validation checks that an outgoing request exists for the target PUUID.

```ts
await client.social.cancelFriendRequest("7d0e2f4a-4567-8901-cdef-0123456789ab");
```

```bash
riotclient friend-cancel 7d0e2f4a-4567-8901-cdef-0123456789ab --yes
```

```json
[]
```

### removeFriend

Removes a player from your friends list using their PUUID.
Unfriends the target and updates the returned friends roster.

```ts
await client.social.removeFriend("4a7b9c1d-1234-5678-9abc-def012345678");
```

```bash
riotclient friend-remove 4a7b9c1d-1234-5678-9abc-def012345678 --yes
```

```json
[]
```

### blockPlayer

Blocks a player by PUUID or Riot ID (`Name#Tag`).
Prevents further incoming messages and removes any existing friend association.

```ts
await client.social.blockPlayer("Troll#NA1");
```

```bash
riotclient block "Troll#NA1" --yes
```

```json
[
  {
    "puuid": "6c9d1e3f-3456-7890-bcde-f0123456789a",
    "gameName": "Troll",
    "tagLine": "NA1"
  }
]
```

### unblockPlayer

Unblocks a previously blocked player using their PUUID.
Permits new interaction attempts from the player.

```ts
await client.social.unblockPlayer("6c9d1e3f-3456-7890-bcde-f0123456789a");
```

```bash
riotclient unblock 6c9d1e3f-3456-7890-bcde-f0123456789a --yes
```

```json
[]
```

### participants

Lists active participants in a specific conversation or chat room.
Returns PUUID, display names, platform identifiers, and mute flags.

```ts
const members = await client.social.participants("room-party-1234@us-1.chat.si.riotgames.com");
console.log(members);
```

```bash
riotclient participants --cid <conversation-id>
```

```json
[
  {
    "cid": "room-party-1234@us-1.chat.si.riotgames.com",
    "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
    "gameName": "Player",
    "tagLine": "NA1",
    "name": "Player#NA1",
    "pid": "4a7b9c1d-1234-5678-9abc-def012345678@us-1.pvp.net",
    "region": "na",
    "muted": false,
    "activePlatform": "riot"
  }
]
```
