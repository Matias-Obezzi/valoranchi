import type { Catalogue } from "../catalogue/Catalogue.js";
import type { LiveMatch, LiveMatchPlayer, Rank } from "../model/index.js";
import type {
  RiotCoreGameLoadoutItem,
  RiotCoreGameLoadoutsResponse,
  RiotCoreGameMatchResponse,
  RiotCoreGamePlayer,
  RiotPregameMatchResponse,
  RiotPregamePlayer,
} from "../riot/types.js";
import {
  RankResolver,
  resolveAgent,
  resolveCard,
  resolveMap,
  resolveTitle,
} from "./RankResolver.js";

const SKIN_SOCKET_UUID = "bcef87d6-209b-46c6-8b19-fbe40bd95abc";
const BUDDY_SOCKET_UUID = "77258665-71d1-4623-bc72-44db9bd5b3b3";

export class LiveMatchBuilder {
  private readonly catalogue: Catalogue;
  private readonly rankResolver: RankResolver;

  constructor(catalogue: Catalogue) {
    this.catalogue = catalogue;
    this.rankResolver = new RankResolver(catalogue);
  }

  buildPregame(
    match: RiotPregameMatchResponse,
    names: Map<string, { gameName: string; tagLine: string }>,
    ranks: Map<string, Rank | null>,
    selfPuuid: string,
  ): LiveMatch {
    const allyPlayers = match.AllyTeam?.Players ?? [];
    const enemyPlayers = match.EnemyTeam?.Players ?? [];
    const allyTeamId = match.AllyTeam?.TeamID ?? "Blue";
    const enemyTeamId = match.EnemyTeam?.TeamID ?? "Red";

    const allies = allyPlayers.map((p) => this.buildPregamePlayer(p, allyTeamId, names, ranks));
    const enemies = enemyPlayers.map((p) => this.buildPregamePlayer(p, enemyTeamId, names, ranks));
    const self = allies.find((p) => p.puuid === selfPuuid) ?? null;

    const phaseEndsInMs = match.PhaseTimeRemainingNS
      ? Math.round(match.PhaseTimeRemainingNS / 1_000_000)
      : null;

    return {
      phase: "pregame",
      matchId: match.ID,
      queue: match.QueueID ?? null,
      ranked: Boolean(match.IsRanked),
      map: resolveMap(this.catalogue, match.MapID ?? ""),
      mode: match.Mode ?? null,
      phaseEndsInMs,
      allies,
      enemies,
      self,
    };
  }

  buildCoreGame(
    match: RiotCoreGameMatchResponse,
    loadouts: RiotCoreGameLoadoutsResponse | null,
    names: Map<string, { gameName: string; tagLine: string }>,
    ranks: Map<string, Rank | null>,
    selfPuuid: string,
  ): LiveMatch {
    if (match.ProvisioningFlow === "ShootingRange") {
      return { phase: "range", matchId: match.MatchID };
    }

    const selfPlayer = match.Players.find((p) => p.Subject === selfPuuid);
    const selfTeam = selfPlayer?.TeamID ?? "Blue";
    const loadoutMap = this.indexLoadouts(loadouts);

    const allies = match.Players.filter((p) => p.TeamID === selfTeam).map((p) =>
      this.buildCoreGamePlayer(p, loadoutMap, names, ranks),
    );
    const enemies = match.Players.filter((p) => p.TeamID !== selfTeam).map((p) =>
      this.buildCoreGamePlayer(p, loadoutMap, names, ranks),
    );
    const self = allies.find((p) => p.puuid === selfPuuid) ?? null;

    return {
      phase: "ingame",
      matchId: match.MatchID,
      queue: match.MatchmakingData?.QueueID ?? null,
      ranked: Boolean(match.MatchmakingData?.IsRanked),
      map: resolveMap(this.catalogue, match.MapID ?? ""),
      mode: match.ModeID ?? null,
      phaseEndsInMs: null,
      allies,
      enemies,
      self,
    };
  }

  private buildPregamePlayer(
    player: RiotPregamePlayer,
    teamId: string,
    names: Map<string, { gameName: string; tagLine: string }>,
    ranks: Map<string, Rank | null>,
  ): LiveMatchPlayer {
    const nameInfo = names.get(player.Subject);
    const rank = ranks.has(player.Subject)
      ? ranks.get(player.Subject)!
      : this.rankResolver.fromTier(player.CompetitiveTier);
    const selection =
      player.CharacterSelectionState === "locked"
        ? "locked"
        : player.CharacterSelectionState === "selected"
          ? "selected"
          : "none";

    return {
      puuid: player.Subject,
      gameName: nameInfo?.gameName ?? null,
      tagLine: nameInfo?.tagLine ?? null,
      incognito: Boolean(player.PlayerIdentity?.Incognito),
      team: teamId,
      agent: resolveAgent(this.catalogue, player.CharacterID),
      selection,
      accountLevel: player.PlayerIdentity?.AccountLevel ?? null,
      card: resolveCard(this.catalogue, player.PlayerIdentity?.PlayerCardID),
      title: resolveTitle(this.catalogue, player.PlayerIdentity?.PlayerTitleID),
      rank,
      partyId: null,
      loadout: null,
    };
  }

  private buildCoreGamePlayer(
    player: RiotCoreGamePlayer,
    loadouts: Map<string, Record<string, RiotCoreGameLoadoutItem>>,
    names: Map<string, { gameName: string; tagLine: string }>,
    ranks: Map<string, Rank | null>,
  ): LiveMatchPlayer {
    const nameInfo = names.get(player.Subject);
    const rank = ranks.get(player.Subject) ?? null;
    const items = loadouts.get(player.Subject);

    return {
      puuid: player.Subject,
      gameName: nameInfo?.gameName ?? null,
      tagLine: nameInfo?.tagLine ?? null,
      incognito: Boolean(player.PlayerIdentity?.Incognito),
      team: player.TeamID ?? "",
      agent: resolveAgent(this.catalogue, player.CharacterID),
      selection: null,
      accountLevel: player.PlayerIdentity?.AccountLevel ?? null,
      card: resolveCard(this.catalogue, player.PlayerIdentity?.PlayerCardID),
      title: resolveTitle(this.catalogue, player.PlayerIdentity?.PlayerTitleID),
      rank,
      partyId: null,
      loadout: items ? this.buildPlayerLoadout(items) : null,
    };
  }

  private indexLoadouts(
    loadouts: RiotCoreGameLoadoutsResponse | null,
  ): Map<string, Record<string, RiotCoreGameLoadoutItem>> {
    const map = new Map<string, Record<string, RiotCoreGameLoadoutItem>>();
    if (!loadouts) return map;
    for (const entry of loadouts.Loadouts ?? []) {
      if (entry?.Loadout?.Subject) {
        map.set(entry.Loadout.Subject, entry.Loadout.Items ?? {});
      }
    }
    return map;
  }

  private buildPlayerLoadout(
    items: Record<string, RiotCoreGameLoadoutItem>,
  ): LiveMatchPlayer["loadout"] {
    const list: NonNullable<LiveMatchPlayer["loadout"]> = [];
    for (const [weaponUuid, rawItem] of Object.entries(items)) {
      list.push(this.decodeItemLoadout(weaponUuid, rawItem));
    }
    return list;
  }

  private decodeItemLoadout(
    weaponUuid: string,
    rawItem: RiotCoreGameLoadoutItem,
  ): NonNullable<LiveMatchPlayer["loadout"]>[number] {
    const weapon = this.catalogue.getWeapon(weaponUuid);
    const skinSocket = rawItem.Sockets?.[SKIN_SOCKET_UUID];
    const skinLevelUuid = skinSocket?.Item?.ID;
    const skinMatch = skinLevelUuid
      ? this.catalogue.findSkinAndWeaponByLevel(skinLevelUuid)
      : undefined;

    const buddySocket = rawItem.Sockets?.[BUDDY_SOCKET_UUID];
    const buddyLevelUuid = buddySocket?.Item?.ID;
    const buddyMatch = buddyLevelUuid ? this.catalogue.findBuddyByLevel(buddyLevelUuid) : undefined;

    return {
      weapon: {
        uuid: weaponUuid,
        name: weapon?.displayName ?? null,
      },
      skin: skinLevelUuid
        ? {
            uuid: skinMatch?.skin.uuid ?? skinLevelUuid,
            name: skinMatch?.skin.displayName ?? null,
            icon: skinMatch?.skin.displayIcon ?? null,
          }
        : null,
      buddy: buddyLevelUuid
        ? {
            uuid: buddyMatch?.buddy.uuid ?? buddyLevelUuid,
            name: buddyMatch?.buddy.displayName ?? null,
            icon: buddyMatch?.buddy.displayIcon ?? null,
          }
        : null,
    };
  }
}
