#!/usr/bin/env node
import { parseArgs } from "node:util";
import {
  RegionUnknownError,
  RiotApiError,
  RiotClientError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
} from "./errors.js";
import { RiotClient } from "./RiotClient.js";

const USAGE = `Usage: riotclient <command> [options]

Commands:
  whoami       Print signed-in player profile and region
  owned-items  Print owned inventory items
  loadout      Print currently equipped loadout
  wallet       Print VP, Radianite, and Kingdom Credits balances

Options:
  --language <lang>  Catalogue language (default: en-US)
  --pretty           Pretty-print JSON output
  --help             Show usage instructions
`;

export function exitCodeForError(error: unknown): number {
  if (
    error instanceof RiotClientNotRunningError ||
    (error as { code?: string })?.code === "RIOT_CLIENT_NOT_RUNNING"
  ) {
    return 2;
  }
  if (
    error instanceof RiotClientNotReadyError ||
    (error as { code?: string })?.code === "RIOT_CLIENT_NOT_READY"
  ) {
    return 3;
  }
  if (
    error instanceof RegionUnknownError ||
    (error as { code?: string })?.code === "REGION_UNKNOWN"
  ) {
    return 4;
  }
  if (error instanceof RiotApiError || (error as { code?: string })?.code === "RIOT_API_ERROR") {
    return 5;
  }
  return 1;
}

export function formatError(error: unknown): { error: { code: string; message: string } } {
  if (error instanceof RiotClientError) {
    return {
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    error: {
      code: "UNKNOWN_ERROR",
      message,
    },
  };
}

export async function runCli(args: string[]): Promise<number> {
  const parsed = parseArgs({
    args,
    options: {
      language: { type: "string" },
      pretty: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  if (parsed.values.help || parsed.positionals.length === 0) {
    process.stdout.write(USAGE);
    return 0;
  }

  const command = parsed.positionals[0];
  const client = new RiotClient({ language: parsed.values.language });

  try {
    let result: unknown;
    if (command === "whoami") {
      result = await client.whoami();
    } else if (command === "owned-items") {
      result = await client.ownedItems({ language: parsed.values.language });
    } else if (command === "loadout") {
      result = await client.loadout();
    } else if (command === "wallet") {
      result = await client.wallet();
    } else {
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
      return 1;
    }

    const output = parsed.values.pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
    process.stdout.write(`${output}\n`);
    return 0;
  } catch (error) {
    const formatted = formatError(error);
    process.stderr.write(`${JSON.stringify(formatted)}\n`);
    return exitCodeForError(error);
  }
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  (process.argv[1].endsWith("cli.js") || process.argv[1].endsWith("cli.ts"));

if (isDirectRun) {
  runCli(process.argv.slice(2)).then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  });
}
