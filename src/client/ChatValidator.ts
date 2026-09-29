import { ValidationError } from "../errors.js";
import type { RawChatFriend, RawFriendRequest } from "../local/chatTypes.js";
import type { BlockedPlayer, Conversation, Friend, FriendRequest } from "../model/index.js";

export class ChatValidator {
  static validateMessageText(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new ValidationError("empty-message", "Message text cannot be empty");
    }
    if (text.length > 1000) {
      throw new ValidationError("message-too-long", "Message text cannot exceed 1000 characters");
    }
    return text;
  }

  static validateMessageTarget(
    to: { puuid: string } | { conversationId: string } | { riotId: string },
    friends: RawChatFriend[],
    conversations: Conversation[],
  ): { cid: string; type: "chat" | "groupchat" } {
    if ("riotId" in to) {
      const { gameName, gameTag } = ChatValidator.parseRiotId(to.riotId);
      const friend = friends.find(
        (f) =>
          f.game_name.toLowerCase() === gameName.toLowerCase() &&
          f.game_tag.toLowerCase() === gameTag.toLowerCase(),
      );
      if (!friend) {
        throw new ValidationError("not-a-friend", `Player ${to.riotId} is not a friend`, {
          riotId: to.riotId,
        });
      }
      return {
        cid: `${friend.puuid}@${friend.region}.pvp.net`,
        type: "chat",
      };
    }

    if ("puuid" in to) {
      const friend = friends.find((f) => f.puuid === to.puuid);
      if (!friend) {
        throw new ValidationError("not-a-friend", `Player ${to.puuid} is not a friend`, {
          puuid: to.puuid,
        });
      }
      return {
        cid: `${friend.puuid}@${friend.region}.pvp.net`,
        type: "chat",
      };
    }

    if ("conversationId" in to) {
      const conv = conversations.find((c) => c.id === to.conversationId);
      if (!conv) {
        throw new ValidationError(
          "unknown-conversation",
          `Conversation ${to.conversationId} not found`,
          { conversationId: to.conversationId },
        );
      }
      return {
        cid: to.conversationId,
        type: conv.kind === "whisper" ? "chat" : "groupchat",
      };
    }

    throw new ValidationError(
      "invalid-target",
      "Target must specify puuid, conversationId, or riotId",
    );
  }

  static parseRiotId(riotId: string): { gameName: string; gameTag: string } {
    const hashIndex = riotId.indexOf("#");
    if (hashIndex <= 0 || hashIndex >= riotId.length - 1) {
      throw new ValidationError("invalid-riot-id", "Expected name#tag format", { riotId });
    }
    const gameName = riotId.slice(0, hashIndex).trim();
    const gameTag = riotId.slice(hashIndex + 1).trim();
    if (!gameName || !gameTag) {
      throw new ValidationError("invalid-riot-id", "Expected name#tag format", { riotId });
    }
    return { gameName, gameTag };
  }

  static validateFriendRequest(
    riotId: string,
    self: { gameName?: string; tagLine?: string },
    friends: Friend[],
    requests: FriendRequest[],
  ): { gameName: string; gameTag: string } {
    const { gameName, gameTag } = this.parseRiotId(riotId);
    const lowerName = gameName.toLowerCase();
    const lowerTag = gameTag.toLowerCase();

    if (self.gameName?.toLowerCase() === lowerName && self.tagLine?.toLowerCase() === lowerTag) {
      throw new ValidationError("cannot-target-self", "Cannot send friend request to yourself");
    }

    const alreadyFriend = friends.some(
      (f) => f.gameName.toLowerCase() === lowerName && f.tagLine.toLowerCase() === lowerTag,
    );
    if (alreadyFriend) {
      throw new ValidationError("already-friends", "Player is already a friend", {
        gameName,
        gameTag,
      });
    }

    const alreadyRequested = requests.some(
      (r) => r.gameName.toLowerCase() === lowerName && r.tagLine.toLowerCase() === lowerTag,
    );
    if (alreadyRequested) {
      throw new ValidationError("already-requested", "Friend request already sent or pending", {
        gameName,
        gameTag,
      });
    }

    return { gameName, gameTag };
  }

  static validateAcceptFriendRequest(
    puuid: string,
    requests: RawFriendRequest[],
  ): { gameName: string; gameTag: string } {
    const req = requests.find((r) => r.puuid === puuid && r.subscription === "pending_in");
    if (!req) {
      throw new ValidationError(
        "no-incoming-request",
        "No incoming friend request from this player",
        {
          puuid,
        },
      );
    }
    return { gameName: req.game_name, gameTag: req.game_tag };
  }

  static validateDeclineFriendRequest(puuid: string, requests: RawFriendRequest[]): void {
    const req = requests.find((r) => r.puuid === puuid && r.subscription === "pending_in");
    if (!req) {
      throw new ValidationError(
        "no-incoming-request",
        "No incoming friend request from this player",
        {
          puuid,
        },
      );
    }
  }

  static validateCancelFriendRequest(puuid: string, requests: RawFriendRequest[]): void {
    const req = requests.find((r) => r.puuid === puuid && r.subscription === "pending_out");
    if (!req) {
      throw new ValidationError(
        "no-outgoing-request",
        "No outgoing friend request to this player",
        {
          puuid,
        },
      );
    }
  }

  static validateRemoveFriend(puuid: string, friends: Friend[]): void {
    const friend = friends.find((f) => f.puuid === puuid);
    if (!friend) {
      throw new ValidationError("not-a-friend", "Player is not in friends list", { puuid });
    }
  }

  static validateBlockPlayer(
    target: string,
    self: { puuid?: string; gameName?: string; tagLine?: string },
    blocked: BlockedPlayer[],
    friends: Friend[],
    requests: FriendRequest[],
  ): string {
    let targetPuuid = target;

    if (target.includes("#")) {
      const { gameName, gameTag } = this.parseRiotId(target);
      const lowerName = gameName.toLowerCase();
      const lowerTag = gameTag.toLowerCase();

      if (self.gameName?.toLowerCase() === lowerName && self.tagLine?.toLowerCase() === lowerTag) {
        throw new ValidationError("cannot-target-self", "Cannot block yourself");
      }

      const match =
        friends.find(
          (f) => f.gameName.toLowerCase() === lowerName && f.tagLine.toLowerCase() === lowerTag,
        ) ??
        requests.find(
          (r) => r.gameName.toLowerCase() === lowerName && r.tagLine.toLowerCase() === lowerTag,
        );

      if (!match) {
        throw new ValidationError("unknown-player", `Cannot resolve player ${target}`, { target });
      }
      targetPuuid = match.puuid;
    }

    if (self.puuid && targetPuuid === self.puuid) {
      throw new ValidationError("cannot-target-self", "Cannot block yourself");
    }

    const alreadyBlocked = blocked.some((b) => b.puuid === targetPuuid);
    if (alreadyBlocked) {
      throw new ValidationError("already-blocked", "Player is already blocked", {
        puuid: targetPuuid,
      });
    }

    return targetPuuid;
  }

  static validateUnblockPlayer(puuid: string, blocked: BlockedPlayer[]): void {
    const isBlocked = blocked.some((b) => b.puuid === puuid);
    if (!isBlocked) {
      throw new ValidationError("not-blocked", "Player is not currently blocked", { puuid });
    }
  }
}
