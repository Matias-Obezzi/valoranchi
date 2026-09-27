import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { RiotClientError } from "./errors.js";
import { RiotClient } from "./RiotClient.js";

export const USAGE = `Usage: riotclient <command> [options]

Commands:
  whoami       Print signed-in player profile and region
  owned-items  Print owned inventory items
  loadout      Print currently equipped loadout
  wallet       Print VP, Radianite, and Kingdom Credits balances

Options:
  --language <lang>  Catalogue language (default: en-US)
  --pretty           Pretty-print JSON output
  --help             Show usage instructions
  --version          Show version number
`;

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

const ERROR_EXIT_CODES: Record<string, number> = {
  RIOT_CLIENT_NOT_RUNNING: 2,
  RIOT_CLIENT_NOT_READY: 3,
  REGION_UNKNOWN: 4,
  RIOT_API_ERROR: 5,
};

export function exitCodeForError(error: unknown): number {
  if (error instanceof RiotClientError) {
    return ERROR_EXIT_CODES[error.code] ?? 1;
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

async function executeCommand(
  client: RiotClient,
  command: string,
  language?: string,
): Promise<unknown> {
  switch (command) {
    case "whoami":
      return client.whoami();
    case "owned-items":
      return client.ownedItems({ language });
    case "loadout":
      return client.loadout();
    case "wallet":
      return client.wallet();
    default:
      return null;
  }
}

export async function runCli(args: string[]): Promise<number> {
  const parsed = parseArgs({
    args,
    options: {
      language: { type: "string" },
      pretty: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
      version: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  if (parsed.values.version) {
    process.stdout.write(`${packageJson.version}\n`);
    return 0;
  }

  if (parsed.values.help || parsed.positionals.length === 0) {
    process.stdout.write(USAGE);
    return 0;
  }

  const command = parsed.positionals[0]!;
  const client = new RiotClient({ language: parsed.values.language });

  try {
    const result = await executeCommand(client, command, parsed.values.language);
    if (result === null) {
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
