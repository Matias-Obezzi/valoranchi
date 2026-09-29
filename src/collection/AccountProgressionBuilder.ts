import type { Catalogue } from "../catalogue/Catalogue.js";
import type {
  AccountXp,
  AccountXpHistoryEntry,
  ContractProgress,
  ContractReward,
  Favourite,
  Image,
  Mission,
  Penalty,
} from "../model/index.js";
import type {
  RiotAccountXpResponse,
  RiotContractsResponse,
  RiotFavoritesResponse,
  RiotPenaltiesResponse,
} from "../riot/types.js";

function resolveRewardDetails(
  catalogue: Catalogue,
  type: string,
  uuid: string,
): { name: string; icon: Image } {
  const t = type.toLowerCase();
  if (t === "spray") {
    const s = catalogue.getSpray(uuid);
    return { name: s?.displayName ?? "", icon: s?.displayIcon ?? null };
  }
  if (t === "playercard") {
    const c = catalogue.getCard(uuid);
    return { name: c?.displayName ?? "", icon: c?.smallArt ?? null };
  }
  if (t === "playertitle") {
    const title = catalogue.getTitle(uuid);
    return { name: title?.displayName ?? "", icon: null };
  }
  if (t === "buddy") {
    const b = catalogue.getBuddy(uuid);
    return { name: b?.displayName ?? "", icon: b?.displayIcon ?? null };
  }
  if (t === "currency") {
    const cur = catalogue.getCurrency(uuid);
    return { name: cur?.displayName ?? "", icon: null };
  }
  const skin = catalogue.getSkin(uuid);
  return { name: skin?.displayName ?? "", icon: skin?.displayIcon ?? null };
}

export class AccountProgressionBuilder {
  static buildAccountXp(raw: RiotAccountXpResponse): AccountXp {
    const history: AccountXpHistoryEntry[] = (raw.History ?? []).map((h) => {
      const sources = { timePlayed: 0, matchWin: 0, firstWinOfTheDay: 0 };
      for (const s of h.XPSources ?? []) {
        if (s.ID === "time-played") sources.timePlayed += s.Amount;
        else if (s.ID === "match-win") sources.matchWin += s.Amount;
        else if (s.ID === "first-win-of-the-day") sources.firstWinOfTheDay += s.Amount;
      }
      return {
        matchId: h.ID,
        at: h.MatchStart,
        before: { level: h.StartProgress.Level, xp: h.StartProgress.XP },
        after: { level: h.EndProgress.Level, xp: h.EndProgress.XP },
        delta: h.XPDelta,
        sources,
      };
    });
    return {
      level: raw.Progress.Level,
      xp: raw.Progress.XP,
      history,
      nextFirstWinAt: raw.NextTimeFirstWinAvailable ?? null,
    };
  }

  static buildContracts(raw: RiotContractsResponse, catalogue: Catalogue): ContractProgress[] {
    const list: ContractProgress[] = [];
    for (const c of raw.Contracts ?? []) {
      const def = catalogue.getContract(c.ContractDefinitionID);
      if (!def) continue;
      const kindRaw = def.content?.relationType?.toLowerCase();
      const kind = kindRaw === "agent" || kindRaw === "season" ? kindRaw : "event";
      const { rewards, nextLevelAt } = this.extractRewards(
        def,
        c.ProgressionLevelReached,
        catalogue,
      );
      list.push({
        uuid: def.uuid,
        name: def.displayName,
        kind,
        level: c.ProgressionLevelReached,
        progress: c.ProgressionTowardsNextLevel,
        nextLevelAt,
        active: raw.ActiveSpecialContract === def.uuid,
        rewards,
      });
    }
    return list;
  }

  private static extractRewards(
    def: ReturnType<Catalogue["getContract"]>,
    reachedLevel: number,
    catalogue: Catalogue,
  ): { rewards: ContractReward[]; nextLevelAt: number | null } {
    let index = 1;
    let nextLevelAt: number | null = null;
    const rewards: ContractReward[] = [];
    for (const ch of def?.content?.chapters ?? []) {
      for (const lvl of ch.levels) {
        if (index === reachedLevel + 1) nextLevelAt = lvl.xp;
        const resolved = resolveRewardDetails(catalogue, lvl.reward.type, lvl.reward.uuid);
        rewards.push({
          level: index,
          type: lvl.reward.type,
          uuid: lvl.reward.uuid,
          name: resolved.name,
          icon: resolved.icon,
          unlocked: index <= reachedLevel,
        });
        index++;
      }
    }
    return { rewards, nextLevelAt };
  }

  static buildMissions(raw: RiotContractsResponse, catalogue: Catalogue): Mission[] {
    return (raw.Missions ?? []).map((m) => {
      const def = catalogue.getMission(m.ID);
      const target = def?.progressToComplete ?? 1;
      const progress = Object.values(m.Objectives ?? {}).reduce((acc, v) => acc + v, 0);
      return {
        uuid: m.ID,
        title: def?.title ?? def?.displayName ?? m.ID,
        progress: m.Complete ? target : progress,
        target,
        complete: m.Complete,
        expiresAt: m.ExpirationTime || null,
      };
    });
  }

  static buildPenalties(raw: RiotPenaltiesResponse): Penalty[] {
    return (raw.Penalties ?? []).map((p) => ({
      id: p.ID,
      reason: p.Reason,
      expiresAt: p.Expiry,
    }));
  }

  static buildFavourites(raw: RiotFavoritesResponse, catalogue: Catalogue): Favourite[] {
    return Object.values(raw.FavoritedContent ?? {}).map((item) => {
      const skin = catalogue.getSkin(item.ItemID);
      const weapon = catalogue.weapons.find((w) =>
        w.skins.some((s) => s.uuid.toLowerCase() === item.ItemID.toLowerCase()),
      );
      return {
        skinUuid: item.ItemID,
        name: skin?.displayName ?? item.ItemID,
        weapon: weapon?.displayName ?? "",
      };
    });
  }
}
