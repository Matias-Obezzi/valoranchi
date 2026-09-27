import { describe, expect, it } from "vitest";
import { MessagesBuilder } from "../src/collection/MessagesBuilder.js";
import type { RawChatMessage, RawChatSession, RawConversation } from "../src/local/chatTypes.js";
import type { Friend } from "../src/model/index.js";

describe("MessagesBuilder", () => {
  const friends: Friend[] = [
    {
      puuid: "puuid-friend-1",
      gameName: "Bestie",
      tagLine: "1111",
      note: null,
      group: "VALORANT",
      region: "na",
      lastOnline: null,
      presence: {
        state: "online",
        product: "valorant",
        since: null,
        valorant: null,
      },
    },
  ];

  it("classifies conversation kinds and resolves participant 'with' for whispers", () => {
    const rawConversations: RawConversation[] = [
      { cid: "puuid-friend-1@la1.pvp.net", type: "chat", unread_count: 2, muted: false },
      { cid: "puuid-stranger@la1.pvp.net", type: "chat", unread_count: 0, muted: true },
      { cid: "party-room@ares-parties.la1.pvp.net", type: "groupchat" },
      { cid: "pregame-room@ares-pregame.la1.pvp.net", type: "groupchat" },
      { cid: "match-123-blue@ares-coregame.la1.pvp.net", type: "groupchat" },
      { cid: "match-123-all@ares-coregame.la1.pvp.net", type: "groupchat" },
    ];

    const builder = new MessagesBuilder(friends);
    const conversations = builder.buildConversations(rawConversations);

    expect(conversations).toEqual([
      {
        id: "puuid-friend-1@la1.pvp.net",
        kind: "whisper",
        unread: 2,
        muted: false,
        with: {
          puuid: "puuid-friend-1",
          gameName: "Bestie",
          tagLine: "1111",
        },
      },
      {
        id: "puuid-stranger@la1.pvp.net",
        kind: "whisper",
        unread: 0,
        muted: true,
        with: null,
      },
      {
        id: "party-room@ares-parties.la1.pvp.net",
        kind: "party",
        unread: 0,
        muted: false,
        with: null,
      },
      {
        id: "pregame-room@ares-pregame.la1.pvp.net",
        kind: "pregame",
        unread: 0,
        muted: false,
        with: null,
      },
      {
        id: "match-123-blue@ares-coregame.la1.pvp.net",
        kind: "team",
        unread: 0,
        muted: false,
        with: null,
      },
      {
        id: "match-123-all@ares-coregame.la1.pvp.net",
        kind: "all",
        unread: 0,
        muted: false,
        with: null,
      },
    ]);
  });

  it("builds messages with whisper and room kinds", () => {
    const rawMessages: RawChatMessage[] = [
      {
        id: "msg-1",
        cid: "puuid-friend-1@la1.pvp.net",
        puuid: "puuid-friend-1",
        game_name: "Bestie",
        game_tag: "1111",
        name: "Bestie#1111",
        pid: "pid-1",
        region: "na",
        body: "Hey there!",
        read: true,
        time: "1700000000000",
        type: "chat",
      },
      {
        id: "msg-2",
        cid: "match-123-all@ares-coregame.la1.pvp.net",
        puuid: "puuid-enemy",
        game_name: "Enemy",
        game_tag: "9999",
        name: "Enemy#9999",
        pid: "pid-2",
        region: "na",
        body: "gg wp",
        read: false,
        time: "1700000010000",
        type: "groupchat",
      },
    ];

    const builder = new MessagesBuilder(friends);
    const messages = builder.buildMessages(rawMessages);

    expect(messages).toEqual([
      {
        id: "msg-1",
        conversationId: "puuid-friend-1@la1.pvp.net",
        from: {
          puuid: "puuid-friend-1",
          gameName: "Bestie",
          tagLine: "1111",
        },
        body: "Hey there!",
        at: new Date(1700000000000).toISOString(),
        read: true,
        kind: "whisper",
      },
      {
        id: "msg-2",
        conversationId: "match-123-all@ares-coregame.la1.pvp.net",
        from: {
          puuid: "puuid-enemy",
          gameName: "Enemy",
          tagLine: "9999",
        },
        body: "gg wp",
        at: new Date(1700000010000).toISOString(),
        read: false,
        kind: "room",
      },
    ]);
  });

  it("fills sender identity on own message when game_name is empty", () => {
    const session: RawChatSession = {
      puuid: "my-puuid",
      game_name: "MyPlayer",
      game_tag: "ME1",
    };

    const rawMessages: RawChatMessage[] = [
      {
        id: "own-1",
        cid: "conv-1@la1.pvp.net",
        puuid: "my-puuid",
        game_name: "",
        game_tag: "",
        name: "",
        pid: "pid-own",
        region: "na",
        body: "my own message",
        read: true,
        time: "1700000000000",
        type: "chat",
      },
      {
        id: "friend-empty-name",
        cid: "conv-2@la1.pvp.net",
        puuid: "puuid-friend-1",
        game_name: "",
        game_tag: "",
        name: "",
        pid: "pid-friend",
        region: "na",
        body: "friend with empty name",
        read: true,
        time: "1700000000000",
        type: "chat",
      },
      {
        id: "stranger-empty-name",
        cid: "conv-3@la1.pvp.net",
        puuid: "stranger-puuid",
        game_name: "",
        game_tag: "",
        name: "",
        pid: "pid-stranger",
        region: "na",
        body: "stranger with empty name",
        read: true,
        time: "1700000000000",
        type: "chat",
      },
    ];

    const builder = new MessagesBuilder(friends, session);
    const messages = builder.buildMessages(rawMessages);

    expect(messages[0]?.from).toEqual({
      puuid: "my-puuid",
      gameName: "MyPlayer",
      tagLine: "ME1",
    });
    expect(messages[1]?.from).toEqual({
      puuid: "puuid-friend-1",
      gameName: "Bestie",
      tagLine: "1111",
    });
    expect(messages[2]?.from).toEqual({
      puuid: "stranger-puuid",
      gameName: "",
      tagLine: "",
    });
  });
});
