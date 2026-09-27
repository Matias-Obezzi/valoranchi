import type { RawChatMessage, RawConversation } from "../local/chatTypes.js";
import type { Conversation, Friend, Message } from "../model/index.js";

export function classifyConversationKind(
  cid: string,
): "whisper" | "party" | "pregame" | "team" | "all" {
  const [room, host = ""] = cid.split("@");
  if (host.startsWith("ares-parties.")) return "party";
  if (host.startsWith("ares-pregame.")) return "pregame";
  if (host.startsWith("ares-coregame.")) {
    return room.endsWith("-all") ? "all" : "team";
  }
  return "whisper";
}

export class MessagesBuilder {
  private readonly friendsByPuuid = new Map<string, Friend>();

  constructor(friends: Friend[] = []) {
    for (const f of friends) {
      if (f.puuid) {
        this.friendsByPuuid.set(f.puuid, f);
      }
    }
  }

  buildConversations(rawConversations: RawConversation[]): Conversation[] {
    return rawConversations.map((conv) => {
      const kind = classifyConversationKind(conv.cid);
      let participant: { puuid: string; gameName: string; tagLine: string } | null = null;

      if (kind === "whisper") {
        const [puuid] = conv.cid.split("@");
        const friend = puuid ? this.friendsByPuuid.get(puuid) : null;
        if (friend) {
          participant = {
            puuid: friend.puuid,
            gameName: friend.gameName,
            tagLine: friend.tagLine,
          };
        }
      }

      return {
        id: conv.cid,
        kind,
        unread: conv.unread_count ?? 0,
        muted: Boolean(conv.muted),
        with: participant,
      };
    });
  }

  buildMessages(rawMessages: RawChatMessage[]): Message[] {
    return rawMessages.map((msg) => {
      const isRoom = msg.type === "groupchat" || classifyConversationKind(msg.cid) !== "whisper";
      const at = msg.time ? new Date(Number(msg.time)).toISOString() : new Date().toISOString();

      return {
        id: msg.id || msg.mid || "",
        conversationId: msg.cid,
        from: {
          puuid: msg.puuid,
          gameName: msg.game_name,
          tagLine: msg.game_tag,
        },
        body: msg.body,
        at,
        read: Boolean(msg.read),
        kind: isRoom ? "room" : "whisper",
      };
    });
  }
}
