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

export function decodeValorantPresence(
  privateField: string | null | undefined,
  catalogue?: Catalogue | null,
): ValorantPresence | null {
  if (!privateField || typeof privateField !== "string") {
    return null;
  }

  try {
    const decoded = Buffer.from(privateField, "base64").toString("utf-8");
    const raw = JSON.parse(decoded) as Record<string, unknown>;
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const matchData = (raw.matchPresenceData as Record<string, unknown> | undefined) ?? {};
    const partyData = (raw.partyPresenceData as Record<string, unknown> | undefined) ?? {};
    const playerData = (raw.playerPresenceData as Record<string, unknown> | undefined) ?? {};

    const rawState = raw.sessionLoopState ?? matchData.sessionLoopState ?? partyData.partyOwnerSessionLoopState;
    const rawQueue = raw.queueId ?? matchData.queueId;
    const rawMap = raw.matchMap ?? matchData.matchMap ?? partyData.partyOwnerMatchMap;

    const rawPartyId = raw.partyId ?? partyData.partyId;
    const rawPartySize = raw.partySize ?? partyData.partySize;
    const rawMaxPartySize = raw.maxPartySize ?? partyData.maxPartySize;
    const rawIsPartyOwner = raw.isPartyOwner ?? partyData.isPartyOwner;

    const rawCardId = raw.playerCardId ?? playerData.playerCardId;
    const rawTitleId = raw.playerTitleId ?? playerData.playerTitleId;

    const rawAlly = raw.partyOwnerMatchScoreAllyTeam ?? partyData.partyOwnerMatchScoreAllyTeam;
    const rawEnemy = raw.partyOwnerMatchScoreEnemyTeam ?? partyData.partyOwnerMatchScoreEnemyTeam;
    const ally = parseNumber(rawAlly);
    const enemy = parseNumber(rawEnemy);

    const card =
      typeof rawCardId === "string" && rawCardId.length > 0
        ? catalogue
          ? (() => {
              const entity = catalogue.getCard(rawCardId);
              return entity
                ? { uuid: entity.uuid.toLowerCase(), name: entity.displayName, small: entity.smallArt }
                : { uuid: rawCardId.toLowerCase(), name: "", small: null };
            })()
          : { uuid: rawCardId.toLowerCase(), name: "", small: null }
        : null;

    const title =
      typeof rawTitleId === "string" && rawTitleId.length > 0
        ? catalogue
          ? (() => {
              const entity = catalogue.getTitle(rawTitleId);
              return entity
                ? { uuid: entity.uuid.toLowerCase(), name: entity.displayName, text: entity.titleText }
                : { uuid: rawTitleId.toLowerCase(), name: "", text: null };
            })()
          : { uuid: rawTitleId.toLowerCase(), name: "", text: null }
        : null;

    return {
      state: parseState(rawState),
      queue: typeof rawQueue === "string" && rawQueue.length > 0 ? rawQueue : null,
      map: typeof rawMap === "string" && rawMap.length > 0 ? rawMap : null,
      party: {
        id: typeof rawPartyId === "string" && rawPartyId.length > 0 ? rawPartyId : null,
        size: parseNumber(rawPartySize),
        max: parseNumber(rawMaxPartySize),
        owner: parseBoolean(rawIsPartyOwner),
      },
      competitiveTier: parseNumber(raw.competitiveTier ?? playerData.competitiveTier),
      leaderboardPosition: parseNumber(raw.leaderboardPosition ?? playerData.leaderboardPosition),
      accountLevel: parseNumber(raw.accountLevel ?? playerData.accountLevel),
      card,
      title,
      score: ally !== null && enemy !== null ? { ally, enemy } : null,
    };
  } catch {
    return null;
  }
}
