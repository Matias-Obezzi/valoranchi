# How It Works

Understand the authentication flow, network boundaries, caching layers, and session lifecycle of `@valoranchi/riot-client`.

## The Lockfile

When the Riot Client starts up on Windows, it creates a transient file on disk:

```
%LOCALAPPDATA%\Riot Games\Riot Client\Config\lockfile
```

The lockfile contains colon-separated metadata:

```
RiotClient:12345:51234:s0meB4s1cT0k3n:https
```

1. **Process name**: Identifies the owning process (`RiotClient`).
2. **Process ID**: The Windows PID of the running instance.
3. **Port**: The local HTTPS port bound by the loopback API.
4. **Password**: The randomly generated password for HTTP Basic authentication (username is `riot`).
5. **Protocol**: The TLS protocol scheme (`https`).

The library parses this file on startup to establish a secure loopback connection with self-signed certificate acceptance restricted exclusively to `127.0.0.1`.

## Local Token Exchange

Once connected to the local loopback server, the library requests your user credentials from the client:

```http
GET https://127.0.0.1:51234/entitlements/v1/token
Authorization: Basic cmlvdDpzMG1lQjRzMWNUMWszbgo=
```

The local API responds with:

- `accessToken`: An OAuth Bearer token representing your player session.
- `token`: An Entitlements JWT issued by Riot for your account.
- `subject`: Your account PUUID.

## Region and Shard Resolution

Remote PVP endpoints require knowing your active server region (such as `na`, `eu`, `ap`, `kr`) and deployment shard.

The library resolves these through the local external sessions API (`/product-session/v1/external-sessions`) by inspecting the running VALORANT product arguments. If the game process is not actively running, fallback resolution parses the most recent player logs to determine the home shard.

## Token Host Rules

Authentication tokens and entitlements JWTs are strictly protected. They may only ever be sent to hosts matching:

- `*.pvp.net` (Riot PVP game and matchmaking services)
- `*.riotgames.com` (Riot identity and platform services)
- `127.0.0.1` (Local loopback client)

The internal `HttpGateway` checks every target URL against this allowlist. If any request would send credentials to an unapproved host, a `ForbiddenHostError` is thrown before any network socket is opened.

Public data sources, including the third-party catalogue API (`valorant-api.com`), are accessed without authorization headers.

## The Catalogue and Disk Cache

Item names, weapon definitions, skin tiers, chromas, buddies, cards, titles, and bundle icons are retrieved from `valorant-api.com`.

To eliminate repetitive downloads, the catalogue for each requested language is cached to disk:

- **Windows**: `%LOCALAPPDATA%\valoranchi-riot-client\catalogue`
- **Other OS**: System temporary directory

The cache is indexed by the current VALORANT client release version. Once downloaded, the catalogue is reused across all subsequent sessions and CLI commands until the next game patch.

You can customize this location or disable disk caching:

```ts
// Save catalogue to custom directory
const client = new RiotClient({ catalogueDir: "C:/data/catalogue" });

// In-memory caching only
const memClient = new RiotClient({ catalogueDir: null });
```

## Response Caching

Remote Riot API responses are fetched live by default. When making repeated queries across short intervals, you can enable a response cache:

```ts
const client = new RiotClient({
  responseCache: { ttlMs: 60_000 },
});
```

From the CLI, pass the cache duration in seconds:

```bash
riotclient store --cache 60
```

Cached responses are stored locally under `%LOCALAPPDATA%\valoranchi-riot-client\responses` partitioned by PUUID and endpoint URL. Entries store only sanitized JSON response bodies and never persist tokens or secrets.

Chat and social data (friends roster, presence status, friend requests, blocked users, and messages) are fetched directly from the local loopback WebSocket and HTTP endpoints and are never cached.

## Shutting Down with close()

Under Node.js, `RiotClient` keeps connection pools and keep-alive sockets open to reduce handshake latency.

Always call `close()` when work completes to terminate idle connections and background timers:

```ts
await client.close();
```

When using `client.events()`, calling `close()` also closes the active WebSocket connection.
