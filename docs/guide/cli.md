# CLI Reference

The `@valoranchi/riot-client` package includes the `riotclient` command-line executable. It connects to the local Riot Client session and writes structured JSON to standard output.

## Overview

Commands can be invoked directly if installed globally, or via `npx`:

```bash
riotclient <command> [options]
npx @valoranchi/riot-client <command> [options]
```

All mutations run in dry-run mode by default. Pass `--yes` to authorize live changes, and both `--yes` and `--confirm` for operations that alter currency balances, dodge queues, or leave active matches.

## Exit Codes

| Code | Symbol | Meaning |
| :--- | :--- | :--- |
| `0` | `SUCCESS` | Successful execution. Output JSON is printed to stdout. |
| `1` | `UNEXPECTED` | Unhandled error or runtime crash. |
| `2` | `RIOT_CLIENT_NOT_RUNNING` | Riot Client lockfile was not found. Start Riot Client and log in. |
| `3` | `RIOT_CLIENT_NOT_READY` | Riot Client is running but local loopback API is not yet ready. |
| `4` | `REGION_UNKNOWN` | Active region and shard could not be determined. |
| `5` | `RIOT_API_ERROR` | Remote Riot PVP service returned an HTTP error. |
| `6` | `VALIDATION` | Local pre-flight validation check failed. |

## Command Reference

The command and option tables below are generated automatically at build time from the source definition in `src/cli.ts`.

<!--@include: ./cli-commands.md-->
