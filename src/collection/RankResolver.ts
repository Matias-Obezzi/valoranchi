import type { Catalogue } from "../catalogue/Catalogue.js";
import type { Agent, OwnedCard, OwnedTitle, Rank } from "../model/index.js";

export class RankResolver {
  private readonly catalogue: Catalogue;

  constructor(catalogue: Catalogue) {
    this.catalogue = catalogue;
  }

  fromTier(tier: number, rating?: number | null): Rank;
  fromTier(tier: number | null | undefined, rating?: number | null): Rank | null;
  fromTier(tier: number | null | undefined, rating: number | null = null): Rank | null {
    if (tier === undefined || tier === null) {
      return null;
    }
    if (tier === 0) {
      return {
        tier: 0,
        name: "Unranked",
        division: null,
        icon: null,
        rating: rating ?? null,
      };
    }
    const match = this.catalogue.getTierByNumber(tier);
    return {
      tier,
      name: match?.tierName ?? "Unranked",
      division: match?.divisionName ?? null,
      icon: match?.largeIcon ?? match?.smallIcon ?? null,
      rating: rating ?? null,
    };
  }
}

export function resolveSeasonName(
  catalogue: Catalogue,
  seasonId: string | null | undefined,
): string | null {
  if (!seasonId) return null;
  const act = catalogue.getSeason(seasonId);
  if (!act) return null;
  const ep = act.parentUuid ? catalogue.getSeason(act.parentUuid) : null;
  return ep ? `${ep.displayName} ${act.displayName}` : act.displayName;
}

export function resolveMap(
  catalogue: Catalogue,
  path: string,
): { uuid: string | null; name: string | null; path: string } {
  const match = catalogue.getMapByPath(path);
  return {
    uuid: match?.uuid ?? null,
    name: match?.displayName ?? null,
    path,
  };
}

export function resolveAgent(
  catalogue: Catalogue,
  characterId: string | null | undefined,
): Agent {
  if (!characterId || characterId === "00000000-0000-0000-0000-000000000000") {
    return null;
  }
  const match = catalogue.getAgent(characterId);
  return match
    ? {
        uuid: characterId.toLowerCase(),
        name: match.displayName,
        icon: match.displayIcon,
        role: match.role?.displayName ?? null,
      }
    : {
        uuid: characterId.toLowerCase(),
        name: "",
        icon: null,
        role: null,
      };
}

export function resolveCard(
  catalogue: Catalogue,
  cardUuid: string | null | undefined,
): OwnedCard | null {
  if (!cardUuid) return null;
  const match = catalogue.getCard(cardUuid);
  if (!match) return null;
  return {
    uuid: match.uuid.toLowerCase(),
    name: match.displayName,
    small: match.smallArt,
    wide: match.wideArt,
    large: match.largeArt,
  };
}

export function resolveTitle(
  catalogue: Catalogue,
  titleUuid: string | null | undefined,
): OwnedTitle | null {
  if (!titleUuid) return null;
  const match = catalogue.getTitle(titleUuid);
  if (!match) return null;
  return {
    uuid: match.uuid.toLowerCase(),
    name: match.displayName,
    text: match.titleText,
  };
}
