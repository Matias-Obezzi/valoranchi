import type { Catalogue } from "../catalogue/Catalogue.js";
import type { Party, PartyMember } from "../model/index.js";
import type { RiotPartyMember, RiotPartyResponse } from "../riot/types.js";
import { RankResolver, resolveCard, resolveTitle } from "./RankResolver.js";

export class PartyBuilder {
  private readonly catalogue: Catalogue;
  private readonly rankResolver: RankResolver;

  constructor(catalogue: Catalogue) {
    this.catalogue = catalogue;
    this.rankResolver = new RankResolver(catalogue);
  }

  build(raw: RiotPartyResponse, names: Map<string, { gameName: string; tagLine: string }>): Party {
    const accessibility = raw.Accessibility?.toLowerCase() === "open" ? "open" : "closed";

    return {
      id: raw.ID,
      state: raw.State,
      accessibility,
      queue: raw.MatchmakingData?.QueueID ?? null,
      inviteCode: raw.InviteCode ?? null,
      queueEnteredAt: raw.QueueEntryTime ?? null,
      members: (raw.Members ?? []).map((m) => this.buildMember(m, names)),
    };
  }

  private buildMember(
    member: RiotPartyMember,
    names: Map<string, { gameName: string; tagLine: string }>,
  ): PartyMember {
    const nameInfo = names.get(member.Subject);
    return {
      puuid: member.Subject,
      gameName: nameInfo?.gameName ?? null,
      tagLine: nameInfo?.tagLine ?? null,
      owner: Boolean(member.IsOwner),
      ready: Boolean(member.IsReady),
      rank: this.rankResolver.fromTier(member.CompetitiveTier),
      accountLevel: member.PlayerIdentity?.AccountLevel ?? null,
      card: resolveCard(this.catalogue, member.PlayerIdentity?.PlayerCardID),
      title: resolveTitle(this.catalogue, member.PlayerIdentity?.PlayerTitleID),
      incognito: Boolean(member.PlayerIdentity?.Incognito),
    };
  }
}
