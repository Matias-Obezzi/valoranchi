import { describe, expect, it } from "vitest";
import { ChatValidator } from "../src/client/ChatValidator.js";
import { ValidationError } from "../src/errors.js";
import type { RawChatFriend, RawFriendRequest } from "../src/local/chatTypes.js";
import type { BlockedPlayer, Conversation, Friend, FriendRequest } from "../src/model/index.js";

describe("ChatValidator", () => {
  describe("validateMessageText", () => {
    it("throws empty-message when text is empty or only whitespace", () => {
      expect(() => ChatValidator.validateMessageText("")).toThrowError(ValidationError);
      try {
        ChatValidator.validateMessageText("   ");
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).reason).toBe("empty-message");
      }
    });

    it("throws message-too-long when text exceeds 1000 characters", () => {
      const longText = "a".repeat(1001);
      try {
        ChatValidator.validateMessageText(longText);
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).reason).toBe("message-too-long");
      }
    });

    it("accepts valid text", () => {
      expect(ChatValidator.validateMessageText("Hello world")).toBe("Hello world");
    });
  });

  describe("validateMessageTarget", () => {
    const friends: RawChatFriend[] = [
      {
        puuid: "p1",
        game_name: "Friend1",
        game_tag: "TAG",
        name: "f1",
        note: null,
        pid: "pid1",
        region: "br1",
        group: "group",
        displayGroup: "group",
        activePlatform: null,
        last_online_ts: null,
      },
    ];

    const conversations: Conversation[] = [
      {
        id: "p1@br1.pvp.net",
        kind: "whisper",
        unread: 0,
        muted: false,
        with: null,
      },
      {
        id: "party-room@ares-parties.na1",
        kind: "party",
        unread: 0,
        muted: false,
        with: null,
      },
    ];

    it("resolves puuid target for a friend with region-specific cid and type chat", () => {
      const res = ChatValidator.validateMessageTarget({ puuid: "p1" }, friends, conversations);
      expect(res).toEqual({
        cid: "p1@br1.pvp.net",
        type: "chat",
      });
    });

    it("throws not-a-friend when puuid is not in friends list", () => {
      try {
        ChatValidator.validateMessageTarget({ puuid: "unknown" }, friends, conversations);
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).reason).toBe("not-a-friend");
      }
    });

    it("resolves conversationId target for whisper with type chat", () => {
      const res = ChatValidator.validateMessageTarget(
        { conversationId: "p1@br1.pvp.net" },
        friends,
        conversations,
      );
      expect(res).toEqual({
        cid: "p1@br1.pvp.net",
        type: "chat",
      });
    });

    it("resolves conversationId target for room with type groupchat", () => {
      const res = ChatValidator.validateMessageTarget(
        { conversationId: "party-room@ares-parties.na1" },
        friends,
        conversations,
      );
      expect(res).toEqual({
        cid: "party-room@ares-parties.na1",
        type: "groupchat",
      });
    });

    it("throws unknown-conversation when conversationId is not in conversations", () => {
      try {
        ChatValidator.validateMessageTarget(
          { conversationId: "missing-room@host" },
          friends,
          conversations,
        );
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).reason).toBe("unknown-conversation");
      }
    });
  });

  describe("parseRiotId", () => {
    it("parses name and tag correctly", () => {
      expect(ChatValidator.parseRiotId("Player#1234")).toEqual({
        gameName: "Player",
        gameTag: "1234",
      });
    });

    it("throws invalid-riot-id on invalid format", () => {
      expect(() => ChatValidator.parseRiotId("Player")).toThrowError(ValidationError);
      expect(() => ChatValidator.parseRiotId("#1234")).toThrowError(ValidationError);
      expect(() => ChatValidator.parseRiotId("Player#")).toThrowError(ValidationError);
    });
  });

  describe("validateFriendRequest", () => {
    const self = { gameName: "MyName", tagLine: "ME1" };
    const friends: Friend[] = [
      {
        puuid: "f1",
        gameName: "ExistingFriend",
        tagLine: "TAG1",
        note: null,
        group: "",
        region: "na",
        lastOnline: null,
        presence: { state: "offline", product: null, since: null, valorant: null },
      },
    ];
    const requests: FriendRequest[] = [
      {
        puuid: "r1",
        gameName: "PendingPlayer",
        tagLine: "TAG2",
        direction: "outgoing",
      },
    ];

    it("throws cannot-target-self when targeting own Riot ID", () => {
      try {
        ChatValidator.validateFriendRequest("MyName#ME1", self, friends, requests);
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).reason).toBe("cannot-target-self");
      }
    });

    it("throws already-friends when already friends", () => {
      try {
        ChatValidator.validateFriendRequest("ExistingFriend#TAG1", self, friends, requests);
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).reason).toBe("already-friends");
      }
    });

    it("throws already-requested when request is already pending", () => {
      try {
        ChatValidator.validateFriendRequest("PendingPlayer#TAG2", self, friends, requests);
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).reason).toBe("already-requested");
      }
    });

    it("passes for new player", () => {
      const res = ChatValidator.validateFriendRequest("NewGuy#NA1", self, friends, requests);
      expect(res).toEqual({ gameName: "NewGuy", gameTag: "NA1" });
    });
  });

  describe("friend request actions validation", () => {
    const requests: RawFriendRequest[] = [
      {
        puuid: "in-1",
        game_name: "IncomingUser",
        game_tag: "IN1",
        name: "",
        note: null,
        pid: "p",
        region: "na",
        subscription: "pending_in",
      },
      {
        puuid: "out-1",
        game_name: "OutgoingUser",
        game_tag: "OUT1",
        name: "",
        note: null,
        pid: "p",
        region: "na",
        subscription: "pending_out",
      },
    ];

    it("validates accept incoming request", () => {
      expect(ChatValidator.validateAcceptFriendRequest("in-1", requests)).toEqual({
        gameName: "IncomingUser",
        gameTag: "IN1",
      });
      expect(() => ChatValidator.validateAcceptFriendRequest("out-1", requests)).toThrowError(
        ValidationError,
      );
      expect(() => ChatValidator.validateAcceptFriendRequest("unknown", requests)).toThrowError(
        ValidationError,
      );
    });

    it("validates decline incoming request", () => {
      expect(() => ChatValidator.validateDeclineFriendRequest("in-1", requests)).not.toThrow();
      expect(() => ChatValidator.validateDeclineFriendRequest("out-1", requests)).toThrowError(
        ValidationError,
      );
    });

    it("validates cancel outgoing request", () => {
      expect(() => ChatValidator.validateCancelFriendRequest("out-1", requests)).not.toThrow();
      expect(() => ChatValidator.validateCancelFriendRequest("in-1", requests)).toThrowError(
        ValidationError,
      );
    });
  });

  describe("validateRemoveFriend", () => {
    const friends: Friend[] = [
      {
        puuid: "f1",
        gameName: "Friend1",
        tagLine: "T1",
        note: null,
        group: "",
        region: "na",
        lastOnline: null,
        presence: { state: "offline", product: null, since: null, valorant: null },
      },
    ];

    it("validates friend exists before removing", () => {
      expect(() => ChatValidator.validateRemoveFriend("f1", friends)).not.toThrow();
      expect(() => ChatValidator.validateRemoveFriend("missing", friends)).toThrowError(
        ValidationError,
      );
    });
  });

  describe("validateBlockPlayer & unblockPlayer", () => {
    const self = { puuid: "self-puuid", gameName: "SelfName", tagLine: "NA1" };
    const blocked: BlockedPlayer[] = [{ puuid: "blocked-1", gameName: "B1", tagLine: "T1" }];
    const friends: Friend[] = [
      {
        puuid: "f1",
        gameName: "FriendPlayer",
        tagLine: "FP1",
        note: null,
        group: "",
        region: "na",
        lastOnline: null,
        presence: { state: "offline", product: null, since: null, valorant: null },
      },
    ];
    const requests: FriendRequest[] = [
      { puuid: "r1", gameName: "ReqPlayer", tagLine: "RP1", direction: "incoming" },
    ];

    it("throws cannot-target-self when blocking self", () => {
      expect(() =>
        ChatValidator.validateBlockPlayer("self-puuid", self, blocked, friends, requests),
      ).toThrowError(ValidationError);
      expect(() =>
        ChatValidator.validateBlockPlayer("SelfName#NA1", self, blocked, friends, requests),
      ).toThrowError(ValidationError);
    });

    it("throws already-blocked when already blocked", () => {
      expect(() =>
        ChatValidator.validateBlockPlayer("blocked-1", self, blocked, friends, requests),
      ).toThrowError(ValidationError);
    });

    it("resolves name#tag from friends or requests", () => {
      expect(
        ChatValidator.validateBlockPlayer("FriendPlayer#FP1", self, blocked, friends, requests),
      ).toBe("f1");
      expect(
        ChatValidator.validateBlockPlayer("ReqPlayer#RP1", self, blocked, friends, requests),
      ).toBe("r1");
    });

    it("throws unknown-player when name#tag cannot be resolved", () => {
      expect(() =>
        ChatValidator.validateBlockPlayer("Stranger#999", self, blocked, friends, requests),
      ).toThrowError(ValidationError);
    });

    it("validates unblockPlayer", () => {
      expect(() => ChatValidator.validateUnblockPlayer("blocked-1", blocked)).not.toThrow();
      expect(() => ChatValidator.validateUnblockPlayer("not-blocked", blocked)).toThrowError(
        ValidationError,
      );
    });
  });
});
