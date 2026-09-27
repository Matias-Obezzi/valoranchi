import type { Catalogue } from "../catalogue/Catalogue.js";
import { decodeValorantPresence } from "../local/Presence.js";
import type { RawChatFriend, RawChatPresence } from "../local/chatTypes.js";
import type { Friend, PresenceState } from "../model/index.js";

function mapPresenceState(state: string | null | undefined): PresenceState {
  switch (state?.toLowerCase()) {
    case "chat":
      return "online";
    case "away":
      return "away";
    case "dnd":
      return "busy";
    case "mobile":
      return "mobile";
    default:
      return "offline";
  }
}

export class FriendsBuilder {
  private readonly rawFriends: RawChatFriend[];
  private readonly rawPresences: RawChatPresence[];
  private readonly catalogue?: Catalogue;

  constructor(
    friends: RawChatFriend[],
    presences: RawChatPresence[],
    catalogue?: Catalogue,
  ) {
    this.rawFriends = friends;
    this.rawPresences = presences;
    this.catalogue = catalogue;
  }

  build(): Friend[] {
    const presenceByPuuid = new Map<string, RawChatPresence>();
    for (const p of this.rawPresences) {
      if (p.puuid) {
        presenceByPuuid.set(p.puuid, p);
      }
    }

    const friends: Friend[] = this.rawFriends.map((f) => {
      const presence = presenceByPuuid.get(f.puuid);
      return this.buildFriend(f, presence);
    });

    friends.sort((a, b) => {
      const aOnline = a.presence.state !== "offline";
      const bOnline = b.presence.state !== "offline";
      if (aOnline !== bOnline) {
        return aOnline ? -1 : 1;
      }
      const nameCmp = a.gameName.localeCompare(b.gameName);
      if (nameCmp !== 0) {
        return nameCmp;
      }
      return a.tagLine.localeCompare(b.tagLine);
    });

    return friends;
  }

  private buildFriend(friend: RawChatFriend, presence?: RawChatPresence): Friend {
    if (!presence) {
      return {
        puuid: friend.puuid,
        gameName: friend.game_name,
        tagLine: friend.game_tag,
        note: friend.note || null,
        group: friend.group ?? friend.displayGroup ?? "",
        region: friend.region ?? "",
        lastOnline: friend.last_online_ts ? new Date(friend.last_online_ts).toISOString() : null,
        presence: {
          state: "offline",
          product: null,
          since: null,
          valorant: null,
        },
      };
    }

    const isValorant = presence.product === "valorant";
    const valorant = isValorant ? decodeValorantPresence(presence.private, this.catalogue) : null;
    const since = presence.time ? new Date(Number(presence.time)).toISOString() : null;

    return {
      puuid: friend.puuid,
      gameName: friend.game_name,
      tagLine: friend.game_tag,
      note: friend.note || null,
      group: friend.group ?? friend.displayGroup ?? "",
      region: friend.region ?? "",
      lastOnline: friend.last_online_ts ? new Date(friend.last_online_ts).toISOString() : null,
      presence: {
        state: mapPresenceState(presence.state),
        product: presence.product ?? null,
        since,
        valorant,
      },
    };
  }
}
