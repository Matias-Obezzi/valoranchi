# Getting Started

Learn how to install `@valoranchi/riot-client`, verify system requirements, and execute your first call in Node and from the CLI.

## Requirements

The library reads credentials and session data from your local Riot Client instance.

- Windows 10 or 11 (64-bit).
- Riot Client running in the background.
- User signed in to VALORANT with an active session.
- Node.js 20.0.0 or later.

## Installation

Add the package as a dependency in your project:

```bash
npm install @valoranchi/riot-client
```

Or install it globally to make the `riotclient` binary available system-wide:

```bash
npm install -g @valoranchi/riot-client
```

## First Call in Node

Import `RiotClient` and call `client.account.whoami()` to retrieve player identity, puuid, and active region:

```ts
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient();

try {
  const player = await client.account.whoami();
  console.log("Player:", player);
} finally {
  await client.close();
}
```

Example JSON output:

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

Always call `await client.close()` when your application is done to cleanly shut down background connection dispatchers.

## CLI Equivalent

Run the `whoami` command using the CLI:

```bash
riotclient whoami
```

To format the JSON output with indentation, append `--pretty`:

```bash
riotclient whoami --pretty
```

You can also run it without local installation using npx:

```bash
npx @valoranchi/riot-client whoami --pretty
```

## Exit Codes

When running `riotclient` in automated scripts, inspect process exit codes to handle failure modes:

| Exit Code | Symbol | Meaning |
| :--- | :--- | :--- |
| `0` | `SUCCESS` | Command completed successfully. JSON is written to stdout. |
| `1` | `UNEXPECTED` | An unhandled exception occurred during execution. |
| `2` | `RIOT_CLIENT_NOT_RUNNING` | Riot Client lockfile was not found on disk. Start Riot Client and log in. |
| `3` | `RIOT_CLIENT_NOT_READY` | Riot Client process is running but loopback API is not yet responding. |
| `4` | `REGION_UNKNOWN` | Active region and shard could not be resolved from client product sessions. |
| `5` | `RIOT_API_ERROR` | Remote PVP endpoint rejected the request (e.g. HTTP 403 or 500). |
| `6` | `VALIDATION` | Local pre-flight validation failed. Request was never sent to Riot servers. |

When a command fails with a non-zero exit code, error details are printed to stderr as structured JSON:

```json
{
  "error": {
    "code": "RIOT_CLIENT_NOT_RUNNING",
    "message": "Riot Client is not running (lockfile not found)"
  }
}
```
