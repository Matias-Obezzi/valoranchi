# Usage by Language

The `@valoranchi/riot-client` ecosystem offers two integration paths depending on your programming language and runtime:

1. **Native In-Process Library (Node.js & TypeScript)**: Import the package directly. You get typed domain models, validated write methods, and an event emitter connected to the local Riot Client WebSocket.
2. **CLI Child Process (Any Language)**: Run the `riotclient` binary as a child process. Receive clean JSON on standard output, detailed structured errors on standard error, and stream real-time events line-by-line via newline-delimited JSON (NDJSON). Strongly-typed data models can be automatically generated using `quicktype` from the committed JSON Schemas in `schema/`.

---

## Language Support Matrix

| Language       | Integration Method                           | Type Definitions                         | Real-Time Events                        | Guide                                     |
| :------------- | :------------------------------------------- | :--------------------------------------- | :-------------------------------------- | :---------------------------------------- |
| **JavaScript** | Native package import (`esm` / `cjs`) or CLI | TypeScript definitions / JSDoc           | `client.events()` or `riotclient watch` | [JavaScript Guide](/languages/javascript) |
| **TypeScript** | Native package import                        | Native exported TypeScript types         | `client.events()` typed emitter         | [TypeScript Guide](/languages/typescript) |
| **C#**         | CLI child process (`Process.Start`)          | `quicktype` (`System.Text.Json` classes) | `riotclient watch` (`ReadLineAsync`)    | [C# Guide](/languages/csharp)             |
| **Java**       | CLI child process (`ProcessBuilder`)         | `quicktype` (Jackson POJOs)              | `riotclient watch` (`BufferedReader`)   | [Java Guide](/languages/java)             |
| **Python**     | CLI child process (`subprocess.run`)         | `quicktype` (`dataclasses`)              | `riotclient watch` (`subprocess.Popen`) | [Python Guide](/languages/python)         |
| **Go**         | CLI child process (`os/exec`)                | `quicktype` (`struct` definitions)       | `riotclient watch` (`bufio.Scanner`)    | [Go Guide](/languages/go)                 |
| **Rust**       | CLI child process (`std::process::Command`)  | `quicktype` (`serde` structs)            | `riotclient watch` (`BufReader::lines`) | [Rust Guide](/languages/rust)             |
| **PHP**        | CLI child process (`proc_open`)              | `quicktype` / Associative arrays         | `riotclient watch` (`fgets`)            | [PHP Guide](/languages/php)               |
| **Ruby**       | CLI child process (`Open3`)                  | `quicktype` / `JSON.parse` hashes        | `riotclient watch` (`each_line`)        | [Ruby Guide](/languages/ruby)             |
| **Shell**      | Direct command line                          | Schema inspection via `jq`               | `riotclient watch` pipe                 | [Shell Guide](/languages/shell)           |

---

## Universal CLI Rules

Every non-Node consumer interacts with the local Riot Client session through the `riotclient` CLI. All commands adhere to a strict and predictable contract.

### 1. Installation

Install the CLI globally with npm:

```bash
npm install -g @valoranchi/riot-client
```

Or execute on-demand without prior installation using `npx`:

```bash
npx @valoranchi/riot-client whoami
```

### 2. Standard Output Contract (Success)

On success, the CLI outputs exactly one valid JSON object (or JSON array) to `stdout` and exits with code `0`:

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

### 3. Standard Error Contract (Failure)

When an operation fails, human error text and machine-readable error details are written to `stderr` formatted as a JSON object:

```json
{
  "error": {
    "code": "VALIDATION",
    "reason": "card-not-owned",
    "message": "Card is not owned",
    "details": {
      "card": "00000000-0000-0000-0000-000000000000"
    }
  }
}
```

### 4. Exit Codes

| Exit Code | Identifier                | Description                                                                  |
| :-------: | :------------------------ | :--------------------------------------------------------------------------- |
|    `0`    | `SUCCESS`                 | Command completed successfully; JSON output written to `stdout`.             |
|    `1`    | `UNKNOWN_ERROR`           | Unknown command or unexpected runtime error.                                 |
|    `2`    | `RIOT_CLIENT_NOT_RUNNING` | Riot Client process is not running or the lockfile cannot be located.        |
|    `3`    | `RIOT_CLIENT_NOT_READY`   | Riot Client is starting up and its local loopback API is not responding yet. |
|    `4`    | `REGION_UNKNOWN`          | Active region/shard could not be determined from active sessions or logs.    |
|    `5`    | `RIOT_API_ERROR`          | Remote Riot PVP service returned an HTTP error (4xx / 5xx).                  |
|    `6`    | `VALIDATION`              | Local pre-flight validation failed (e.g. item not owned, invalid arguments). |

### 5. Writes Safety: Dry Runs by Default

Every mutation command defaults to a **dry run**. It validates the action against your local inventory, catalogue, or party state and outputs the validated payload to `stdout` without sending any network request to Riot:

```bash
# Dry run: validates and outputs the PUT payload without mutating
riotclient equip --card 0819fbcd-4bd4-c379-5384-52803440f2b2
```

To apply the mutation, pass the `--yes` flag:

```bash
# Executes the write
riotclient equip --card 0819fbcd-4bd4-c379-5384-52803440f2b2 --yes
```

#### Dual Confirmation for Sensitive Writes

High-impact actions that spend currency, incur matchmaking penalties, or alter client settings require **both** `--yes` and `--confirm`:

- Store purchases (`buy`): spends VP, Radianite, or Kingdom Credits.
- Queue dodging (`dodge`): aborts agent select and incurs MMR/queue restrictions.
- Leaving a match (`leave-match`): abandons an active game.
- Cloud settings overwrite (`settings-save`): alters cloud preferences.

```bash
# Fails with exit code 6 (reason: "confirm-required") if --confirm is missing
riotclient buy --offer 4324a482-47da-4521-b3b0-4dbfcfefd779 --yes --confirm
```

### 6. Common Command Options

- `--language <code>`: Locale code for catalogue items (e.g. `en-US`, `es-ES`, `de-DE`, `ja-JP`, `ko-KR`).
- `--cache <seconds>`: Reuses cached responses for read operations for `<seconds>` seconds, saving network calls to Riot servers.
- `--pretty`: Formats the JSON output with 2-space indentation.

### 7. Real-Time Event Streaming (`watch`)

The `riotclient watch` command connects to the local Riot Client WebSocket and streams events indefinitely as newline-delimited JSON (NDJSON) over `stdout`:

```bash
riotclient watch --only friend:presence,message
```

Each line is a standalone JSON object:

```json
{"event":"friend:presence","at":"2026-09-29T18:00:00.000Z","data":{"friend":{"gameName":"TenZ","tagLine":"001","presence":{"state":"online"}},"change":"update"}}
{"event":"message","at":"2026-09-29T18:00:05.000Z","data":{"from":{"gameName":"TenZ","tagLine":"001"},"body":"duo queue?"}}
```
