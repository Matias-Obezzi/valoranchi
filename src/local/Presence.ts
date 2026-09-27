import type { Catalogue } from "../catalogue/Catalogue.js";
import type { ValorantPresence } from "../model/index.js";

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseState(raw: unknown): "menus" | "pregame" | "ingame" | null {
  if (typeof raw !== "string") return null;
  const lower = raw.toLowerCase();
  if (lower === "menus" || lower === "pregame" || lower === "ingame") {
    return lower;
  }
  return null;
}

function readRaw(privateField: string | null | undefined): Record<string, unknown> | null {
  if (!privateField || typeof privateField !== "string") {
    return null;
  }
  try {
    const decoded = Buffer.from(privateField, "base64").toString("utf-8");
    const raw = JSON.parse(decoded) as unknown;
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function resolveCard(catalogue: Catalogue | null | undefined, uuid: unknown) {
  if (typeof uuid !== "string" || uuid.length === 0) return null;
  const entity = catalogue?.getCard(uuid);
  return entity
    ? {
        uuid: entity.uuid.toLowerCase(),
        name: entity.displayName,
        small: entity.smallArt,
      }
    : { uuid: uuid.toLowerCase(), name: "", small: null };
}

function resolveTitle(catalogue: Catalogue | null | undefined, uuid: unknown) {
  if (typeof uuid !== "string" || uuid.length === 0) return null;
  const entity = catalogue?.getTitle(uuid);
  return entity
    ? {
        uuid: entity.uuid.toLowerCase(),
        name: entity.displayName,
        text: entity.titleText,
      }
    : { uuid: uuid.toLowerCase(), name: "", text: null };
}

function readState(
  raw: Record<string, unknown>,
  matchData: Record<string, unknown>,
  partyData: Record<string, unknown>,
) {
  return parseState(
    raw.sessionLoopState ?? matchData.sessionLoopState ?? partyData.partyOwnerSessionLoopState,
  );
}

function readParty(raw: Record<string, unknown>, partyData: Record<string, unknown>) {
  const rawPartyId = raw.partyId ?? partyData.partyId;
  return {
    id: typeof rawPartyId === "string" && rawPartyId.length > 0 ? rawPartyId : null,
    size: parseNumber(raw.partySize ?? partyData.partySize),
    max: parseNumber(raw.maxPartySize ?? partyData.maxPartySize),
    owner: parseBoolean(raw.isPartyOwner ?? partyData.isPartyOwner),
  };
}

function readScore(raw: Record<string, unknown>, partyData: Record<string, unknown>) {
  const ally = parseNumber(
    raw.partyOwnerMatchScoreAllyTeam ?? partyData.partyOwnerMatchScoreAllyTeam,
  );
  const enemy = parseNumber(
    raw.partyOwnerMatchScoreEnemyTeam ?? partyData.partyOwnerMatchScoreEnemyTeam,
  );
  return ally !== null && enemy !== null ? { ally, enemy } : null;
}

function readIdentity(
  raw: Record<string, unknown>,
  playerData: Record<string, unknown>,
  catalogue?: Catalogue | null,
) {
  return {
    competitiveTier: parseNumber(raw.competitiveTier ?? playerData.competitiveTier),
    leaderboardPosition: parseNumber(raw.leaderboardPosition ?? playerData.leaderboardPosition),
    accountLevel: parseNumber(raw.accountLevel ?? playerData.accountLevel),
    card: resolveCard(catalogue, raw.playerCardId ?? playerData.playerCardId),
    title: resolveTitle(catalogue, raw.playerTitleId ?? playerData.playerTitleId),
  };
}

export function decodeValorantPresence(
  privateField: string | null | undefined,
  catalogue?: Catalogue | null,
): ValorantPresence | null {
  const raw = readRaw(privateField);
  if (!raw) return null;

  const matchData = (raw.matchPresenceData as Record<string, unknown> | undefined) ?? {};
  const partyData = (raw.partyPresenceData as Record<string, unknown> | undefined) ?? {};
  const playerData = (raw.playerPresenceData as Record<string, unknown> | undefined) ?? {};

  const rawQueue = raw.queueId ?? matchData.queueId;
  const rawMap = raw.matchMap ?? matchData.matchMap ?? partyData.partyOwnerMatchMap;

  return {
    state: readState(raw, matchData, partyData),
    queue: typeof rawQueue === "string" && rawQueue.length > 0 ? rawQueue : null,
    map: typeof rawMap === "string" && rawMap.length > 0 ? rawMap : null,
    party: readParty(raw, partyData),
    score: readScore(raw, partyData),
    ...readIdentity(raw, playerData, catalogue),
  };
}
