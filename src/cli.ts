import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { RiotClientError } from "./errors.js";
import { RiotClient } from "./RiotClient.js";

export const USAGE = `Usage: riotclient <command> [options]

Commands:
  whoami           Print signed-in player profile and region
  owned-items      Print owned inventory items
  loadout          Print currently equipped loadout
  wallet           Print VP, Radianite, and Kingdom Credits balances
  friends          Print friends roster and presence
  friend-requests  Print incoming and outgoing friend requests
  blocked          Print blocked players
  conversations    Print whisper and match chat conversations
  messages         Print chat messages (filter with --cid <id>)
  store            Print daily, night market, bundle, and accessory offers
  watch            Stream real-time events as JSON lines until interrupted

Options:
  --only <events>    Comma-separated list of event names to print
  --raw              Include raw client event frames
  --cid <id>         Conversation ID for filtering messages
  --language <lang>  Catalogue language (default: en-US)
  --cache <seconds>  Reuse Riot responses younger than this many seconds
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

export function formatWatchLine(
  event: string,
  data: unknown,
  at: string = new Date().toISOString(),
): string {
  return JSON.stringify({
    event,
    at,
    data: data !== undefined ? data : null,
  });
}

const WATCH_EVENTS = [
  "connected",
  "disconnected",
  "friend:presence",
  "friend:added",
  "friend:removed",
  "friend:request",
  "message",
  "party",
  "game",
  "self:state",
  "raw",
  "error",
] as const;

export async function runWatch(
  client: RiotClient,
  options: { only?: string; raw?: boolean } = {},
): Promise<number> {
  const allowed = options.only
    ? new Set(options.only.split(",").map((s) => s.trim()).filter(Boolean))
    : null;
  const includeRaw = Boolean(options.raw);
  const events = client.events();

  const printEvent = (event: string, data?: unknown) => {
    if (event === "raw" && !includeRaw) return;
    if (allowed && !allowed.has(event)) return;
    const payload = data instanceof Error ? { name: data.name, message: data.message } : data;
    process.stdout.write(`${formatWatchLine(event, payload)}\n`);
  };

  for (const name of WATCH_EVENTS) {
    events.on(name, (...args: unknown[]) => {
      printEvent(name, args[0]);
    });
  }

  await new Promise<void>((resolve) => {
    const onSignal = () => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolve();
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
  });

  await client.close();
  return 0;
}

async function executeCommand(
  client: RiotClient,
  command: string,
  options?: { language?: string; cid?: string },
): Promise<unknown> {
  switch (command) {
    case "whoami":
      return client.whoami();
    case "owned-items":
      return client.ownedItems({ language: options?.language });
    case "loadout":
      return client.loadout();
    case "wallet":
      return client.wallet();
    case "friends":
      return client.friends();
    case "friend-requests":
      return client.friendRequests();
    case "blocked":
      return client.blocked();
    case "conversations":
      return client.conversations();
    case "messages":
      return client.messages(options?.cid);
    case "store":
      return client.store({ language: options?.language });
    default:
      return null;
  }
}

export async function runCli(args: string[]): Promise<number> {
  const parsed = parseArgs({
    args,
    options: {
      cid: { type: "string" },
      language: { type: "string" },
      cache: { type: "string" },
      only: { type: "string" },
      raw: { type: "boolean", default: false },
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
  const cacheSeconds = Number(parsed.values.cache ?? 0);
  const client = new RiotClient({
    language: parsed.values.language,
    responseCache: cacheSeconds > 0 ? { ttlMs: cacheSeconds * 1000 } : undefined,
  });

  try {
    if (command === "watch") {
      return await runWatch(client, {
        only: parsed.values.only,
        raw: parsed.values.raw,
      });
    }

    const result = await executeCommand(client, command, {
      language: parsed.values.language,
      cid: parsed.values.cid,
    });
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
  } finally {
    await client.close();
  }
}
