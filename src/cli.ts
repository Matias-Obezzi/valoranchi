import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { RiotClientError, ValidationError } from "./errors.js";
import { RiotClient, type LoadoutChange, type LoadoutGunChange } from "./RiotClient.js";

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
  matches          Print recent match history summaries
  match <id>       Print full match details by ID
  mmr              Print current rank, rating, and MMR breakdown
  rank-history     Print competitive rating adjustments and tier changes
  live             Print live pregame or in-game lobby status and loadouts
  party            Print current party details and members
  watch            Stream real-time events as JSON lines until interrupted

Write Commands (dry-run by default, add --yes to execute):
  send             Send chat message (--to <puuid|name#tag|cid> --text <msg>)
  friend-request   Send friend request (<name#tag>)
  friend-accept    Accept friend request (<puuid>)
  friend-decline   Decline friend request (<puuid>)
  friend-cancel    Cancel friend request (<puuid>)
  friend-remove    Remove friend (<puuid>)
  block            Block player (<puuid|name#tag>)
  unblock          Unblock player (<puuid>)
  equip            Equip skins, buddies, sprays, card, title, border, flex
  equip-collection Equip a collection of skins (<skinUuid,...>)

Options:
  --yes              Execute write command (default is dry-run)
  --to <target>      Message recipient (puuid, name#tag, or cid)
  --text <msg>       Message text
  --gun <spec>       Gun to equip: <weapon>=<skin>[:level[:chroma]] (repeatable)
  --buddy <spec>     Buddy to equip: <weapon>=<buddy|none> (repeatable)
  --spray <spec>     Spray to equip: <slot>=<uuid|none> (repeatable)
  --card <uuid>      Player card UUID
  --title <uuid>     Player title UUID
  --flex <uuid|none> Flex item UUID or none
  --border <uuid>    Level border UUID
  --incognito <on|off> Enable or disable incognito
  --hide-level <on|off> Hide or show account level
  --count <n>        Number of matches or rank history entries to fetch
  --queue <queue>    Queue filter (e.g. competitive, unrated)
  --ranks            Fetch MMR and rank for each player in live match
  --no-loadouts      Skip fetching player loadouts in live match
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
  VALIDATION: 6,
};

export function exitCodeForError(error: unknown): number {
  if (error instanceof RiotClientError) {
    return ERROR_EXIT_CODES[error.code] ?? 1;
  }
  return 1;
}

export function formatError(error: unknown): {
  error: {
    code: string;
    message: string;
    reason?: string;
    details?: Record<string, unknown>;
  };
} {
  if (error instanceof ValidationError) {
    return {
      error: {
        code: error.code,
        reason: error.reason,
        message: error.message,
        details: error.details,
      },
    };
  }
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
    ? new Set(
        options.only
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
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

interface CliCommandOptions {
  language?: string;
  cid?: string;
  count?: number;
  queue?: string;
  ranks?: boolean;
  loadouts?: boolean;
  matchId?: string;
  yes?: boolean;
  positionals?: string[];
  rawValues?: Record<string, unknown>;
}

const UNKNOWN_COMMAND = Symbol("UNKNOWN_COMMAND");

function parseTarget(to: string): { puuid: string } | { conversationId: string } | { riotId: string } {
  if (to.includes("#")) return { riotId: to };
  if (to.includes("@")) return { conversationId: to };
  return { puuid: to };
}

function parseBooleanFlag(name: string, value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).toLowerCase();
  if (str === "on" || str === "true") return true;
  if (str === "off" || str === "false") return false;
  throw new ValidationError("invalid-argument", `Expected ${name} on|off, received: ${String(value)}`);
}

function parseNullableUuid(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value);
  if (str.toLowerCase() === "none" || str.toLowerCase() === "null") return null;
  return str;
}

function parseSprays(sprayArgs: string[] | undefined): Array<string | null | undefined> | undefined {
  if (!sprayArgs) return undefined;
  const sprays: Array<string | null | undefined> = [undefined, undefined, undefined];
  for (const arg of sprayArgs) {
    const eqIdx = arg.indexOf("=");
    if (eqIdx === -1) {
      throw new ValidationError("invalid-argument", `Invalid spray spec: ${arg}. Expected <slot>=<uuid|none>`);
    }
    const slotNum = Number(arg.slice(0, eqIdx));
    if (isNaN(slotNum) || slotNum < 0 || slotNum > 2) {
      throw new ValidationError("too-many-sprays", `Invalid spray slot: ${arg.slice(0, eqIdx)}. Expected 0, 1, or 2`);
    }
    sprays[slotNum] = parseNullableUuid(arg.slice(eqIdx + 1));
  }
  return sprays;
}

function parseGuns(
  gunArgs: string[] | undefined,
  buddyArgs: string[] | undefined,
): LoadoutGunChange[] | undefined {
  if (!gunArgs && !buddyArgs) return undefined;
  const gunsMap = new Map<string, LoadoutGunChange>();

  if (gunArgs) {
    for (const arg of gunArgs) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx === -1) {
        throw new ValidationError(
          "invalid-argument",
          `Invalid gun spec: ${arg}. Expected <weapon>=<skin>[:level[:chroma]]`,
        );
      }
      const weapon = arg.slice(0, eqIdx);
      const rest = arg.slice(eqIdx + 1);
      const parts = rest.split(":");
      const skin = parts[0] || undefined;
      const level = parts[1] || undefined;
      const chroma = parts[2] || undefined;
      gunsMap.set(weapon.toLowerCase(), { weapon, skin, level, chroma });
    }
  }

  if (buddyArgs) {
    for (const arg of buddyArgs) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx === -1) {
        throw new ValidationError("invalid-argument", `Invalid buddy spec: ${arg}. Expected <weapon>=<buddy|none>`);
      }
      const weapon = arg.slice(0, eqIdx);
      const buddy = parseNullableUuid(arg.slice(eqIdx + 1));
      const existing = gunsMap.get(weapon.toLowerCase());
      if (existing) {
        existing.buddy = buddy;
      } else {
        gunsMap.set(weapon.toLowerCase(), { weapon, buddy });
      }
    }
  }

  return Array.from(gunsMap.values());
}

function parseEquipChange(values: Record<string, unknown>): LoadoutChange {
  const border = (values.border ?? values["level-border"]) as string | undefined;
  return {
    guns: parseGuns(values.gun as string[] | undefined, values.buddy as string[] | undefined),
    sprays: parseSprays(values.spray as string[] | undefined),
    flex: parseNullableUuid(values.flex),
    card: values.card as string | undefined,
    title: values.title as string | undefined,
    levelBorder: border,
    incognito: parseBooleanFlag("incognito", values.incognito),
    hideAccountLevel: parseBooleanFlag("hide-level", values["hide-level"] ?? values["hide-account-level"]),
  };
}

async function executeStandardCommand(
  client: RiotClient,
  command: string,
  options?: CliCommandOptions,
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
      return UNKNOWN_COMMAND;
  }
}

async function executeGameCommand(
  client: RiotClient,
  command: string,
  options?: CliCommandOptions,
): Promise<unknown> {
  switch (command) {
    case "matches":
      return client.matches({ count: options?.count, queue: options?.queue });
    case "match":
      if (!options?.matchId) {
        throw new Error("Missing match ID: riotclient match <id>");
      }
      return client.match(options.matchId);
    case "mmr":
      return client.mmr();
    case "rank-history":
      return client.rankHistory({ count: options?.count });
    case "live":
      return client.liveMatch({ ranks: options?.ranks, loadouts: options?.loadouts });
    case "party":
      return client.party();
    default:
      return UNKNOWN_COMMAND;
  }
}

async function executeWriteCommand(
  client: RiotClient,
  command: string,
  options?: CliCommandOptions,
): Promise<unknown> {
  const yes = Boolean(options?.yes);
  const pos = options?.positionals ?? [];
  const vals = options?.rawValues ?? {};

  switch (command) {
    case "send": {
      const to = vals.to as string | undefined;
      const text = vals.text as string | undefined;
      if (!to || text === undefined) {
        throw new ValidationError(
          "invalid-argument",
          "Usage: riotclient send --to <puuid|name#tag|cid> --text <message>",
        );
      }
      const target = parseTarget(to);
      return yes ? client.sendMessage(target, text) : client.validateSendMessage(target, text);
    }
    case "friend-request": {
      const riotId = pos[1];
      if (!riotId) {
        throw new ValidationError("invalid-argument", "Usage: riotclient friend-request <name#tag>");
      }
      return yes ? client.sendFriendRequest(riotId) : client.validateSendFriendRequest(riotId);
    }
    case "friend-accept": {
      const puuid = pos[1];
      if (!puuid) {
        throw new ValidationError("invalid-argument", "Usage: riotclient friend-accept <puuid>");
      }
      return yes ? client.acceptFriendRequest(puuid) : client.validateAcceptFriendRequest(puuid);
    }
    case "friend-decline": {
      const puuid = pos[1];
      if (!puuid) {
        throw new ValidationError("invalid-argument", "Usage: riotclient friend-decline <puuid>");
      }
      return yes ? client.declineFriendRequest(puuid) : client.validateDeclineFriendRequest(puuid);
    }
    case "friend-cancel": {
      const puuid = pos[1];
      if (!puuid) {
        throw new ValidationError("invalid-argument", "Usage: riotclient friend-cancel <puuid>");
      }
      return yes ? client.cancelFriendRequest(puuid) : client.validateCancelFriendRequest(puuid);
    }
    case "friend-remove": {
      const puuid = pos[1];
      if (!puuid) {
        throw new ValidationError("invalid-argument", "Usage: riotclient friend-remove <puuid>");
      }
      return yes ? client.removeFriend(puuid) : client.validateRemoveFriend(puuid);
    }
    case "block": {
      const target = pos[1];
      if (!target) {
        throw new ValidationError("invalid-argument", "Usage: riotclient block <puuid|name#tag>");
      }
      return yes ? client.blockPlayer(target) : client.validateBlockPlayer(target);
    }
    case "unblock": {
      const puuid = pos[1];
      if (!puuid) {
        throw new ValidationError("invalid-argument", "Usage: riotclient unblock <puuid>");
      }
      return yes ? client.unblockPlayer(puuid) : client.validateUnblockPlayer(puuid);
    }
    case "equip": {
      const change = parseEquipChange(vals);
      return yes ? client.equip(change) : client.validateEquip(change);
    }
    case "equip-collection": {
      const raw = pos.slice(1).join(",");
      const skinUuids = raw.split(",").map((s) => s.trim()).filter(Boolean);
      if (skinUuids.length === 0) {
        throw new ValidationError("invalid-argument", "Usage: riotclient equip-collection <skinUuid,...>");
      }
      return yes ? client.equipCollection(skinUuids) : client.validateEquipCollection(skinUuids);
    }
    default:
      return UNKNOWN_COMMAND;
  }
}

async function executeCommand(
  client: RiotClient,
  command: string,
  options?: CliCommandOptions,
): Promise<unknown> {
  const std = await executeStandardCommand(client, command, options);
  if (std !== UNKNOWN_COMMAND) return std;
  const game = await executeGameCommand(client, command, options);
  if (game !== UNKNOWN_COMMAND) return game;
  return executeWriteCommand(client, command, options);
}

export async function runCli(args: string[]): Promise<number> {
  const parsed = parseArgs({
    args,
    options: {
      cid: { type: "string" },
      count: { type: "string" },
      queue: { type: "string" },
      ranks: { type: "boolean", default: false },
      "no-loadouts": { type: "boolean", default: false },
      loadouts: { type: "boolean" },
      language: { type: "string" },
      cache: { type: "string" },
      only: { type: "string" },
      raw: { type: "boolean", default: false },
      pretty: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
      version: { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
      to: { type: "string" },
      text: { type: "string" },
      gun: { type: "string", multiple: true },
      buddy: { type: "string", multiple: true },
      spray: { type: "string", multiple: true },
      card: { type: "string" },
      title: { type: "string" },
      flex: { type: "string" },
      border: { type: "string" },
      "level-border": { type: "string" },
      incognito: { type: "string" },
      "hide-level": { type: "string" },
      "hide-account-level": { type: "string" },
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

    const count = parsed.values.count ? Number(parsed.values.count) : undefined;
    const loadouts = parsed.values["no-loadouts"] ? false : (parsed.values.loadouts ?? true);
    const result = await executeCommand(client, command, {
      language: parsed.values.language,
      cid: parsed.values.cid,
      count,
      queue: parsed.values.queue,
      ranks: Boolean(parsed.values.ranks),
      loadouts,
      matchId: command === "match" ? parsed.positionals[1] : undefined,
      yes: Boolean(parsed.values.yes),
      positionals: parsed.positionals,
      rawValues: parsed.values,
    });
    if (result === UNKNOWN_COMMAND) {
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
