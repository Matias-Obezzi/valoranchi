import { describe, expect, it } from "vitest";
import { FriendsBuilder } from "../src/collection/FriendsBuilder.js";
import type { RawChatFriend, RawChatPresence } from "../src/local/chatTypes.js";

describe("FriendsBuilder", () => {
  it("maps presence states, handles offline friends, and sorts online first then by name", () => {
    const rawFriends: RawChatFriend[] = [
      {
        puuid: "p-zeta",
        game_name: "Zeta",
        game_tag: "1111",
        name: "Zeta#1111",
        note: null,
        pid: "pid-zeta",
        region: "na",
        group: "VALORANT",
        displayGroup: "VALORANT",
        activePlatform: null,
        last_online_ts: 1700000000000,
      },
      {
        puuid: "p-alpha-offline",
        game_name: "Alpha",
        game_tag: "0000",
        name: "Alpha#0000",
        note: "Old friend",
        pid: "pid-alpha",
        region: "na",
        group: "VALORANT",
        displayGroup: "VALORANT",
        activePlatform: null,
        last_online_ts: 1600000000000,
      },
      {
        puuid: "p-beta",
        game_name: "Beta",
        game_tag: "2222",
        name: "Beta#2222",
        note: null,
        pid: "pid-beta",
        region: "na",
        group: "VALORANT",
        displayGroup: "VALORANT",
        activePlatform: null,
        last_online_ts: null,
      },
      {
        puuid: "p-gamma-lol",
        game_name: "Gamma",
        game_tag: "3333",
        name: "Gamma#3333",
        note: null,
        pid: "pid-gamma",
        region: "na",
        group: "League",
        displayGroup: "League",
        activePlatform: null,
        last_online_ts: null,
      },
      {
        puuid: "p-delta",
        game_name: "Delta",
        game_tag: "4444",
        name: "Delta#4444",
        note: null,
        pid: "pid-delta",
        region: "na",
        group: "VALORANT",
        displayGroup: "VALORANT",
        activePlatform: null,
        last_online_ts: null,
      },
      {
        puuid: "p-epsilon",
        game_name: "Epsilon",
        game_tag: "5555",
        name: "Epsilon#5555",
        note: null,
        pid: "pid-epsilon",
        region: "na",
        group: "VALORANT",
        displayGroup: "VALORANT",
        activePlatform: null,
        last_online_ts: null,
      },
    ];

    const rawPresences: RawChatPresence[] = [
      {
        puuid: "p-zeta",
        game_name: "Zeta",
        game_tag: "1111",
        pid: "pid-zeta",
        product: "valorant",
        state: "chat", // -> online
        private: Buffer.from(JSON.stringify({ sessionLoopState: "MENUS" })).toString("base64"),
        time: 1700000050000,
      },
      {
        puuid: "p-beta",
        game_name: "Beta",
        game_tag: "2222",
        pid: "pid-beta",
        product: "valorant",
        state: "away", // -> away
        private: null,
        time: 1700000060000,
      },
      {
        puuid: "p-gamma-lol",
        game_name: "Gamma",
        game_tag: "3333",
        pid: "pid-gamma",
        product: "league_of_legends",
        state: "dnd", // -> busy
        private: null,
        time: 1700000070000,
      },
      {
        puuid: "p-delta",
        game_name: "Delta",
        game_tag: "4444",
        pid: "pid-delta",
        product: "valorant",
        state: "mobile", // -> mobile
        private: null,
        time: 1700000080000,
      },
      {
        puuid: "p-epsilon",
        game_name: "Epsilon",
        game_tag: "5555",
        pid: "pid-epsilon",
        product: "valorant",
        state: "other_unknown", // -> offline
        private: null,
        time: 1700000090000,
      },
      // p-alpha-offline has NO presence entry
    ];

    const builder = new FriendsBuilder(rawFriends, rawPresences);
    const friends = builder.build();

    // Verify online friends come first:
    // Online friends: Beta (away), Delta (mobile), Gamma (busy), Zeta (online)
    // Offline friends: Alpha (no presence), Epsilon (unknown state -> offline)
    // Alphabetical within online: Beta, Delta, Gamma, Zeta
    // Alphabetical within offline: Alpha, Epsilon
    expect(friends.map((f) => f.gameName)).toEqual([
      "Beta",
      "Delta",
      "Gamma",
      "Zeta",
      "Alpha",
      "Epsilon",
    ]);

    // Check states:
    const zeta = friends.find((f) => f.puuid === "p-zeta")!;
    expect(zeta.presence.state).toBe("online");
    expect(zeta.presence.product).toBe("valorant");
    expect(zeta.presence.valorant?.state).toBe("menus");

    const beta = friends.find((f) => f.puuid === "p-beta")!;
    expect(beta.presence.state).toBe("away");

    const gamma = friends.find((f) => f.puuid === "p-gamma-lol")!;
    expect(gamma.presence.state).toBe("busy");
    expect(gamma.presence.product).toBe("league_of_legends");
    expect(gamma.presence.valorant).toBeNull();

    const delta = friends.find((f) => f.puuid === "p-delta")!;
    expect(delta.presence.state).toBe("mobile");

    const alpha = friends.find((f) => f.puuid === "p-alpha-offline")!;
    expect(alpha.presence.state).toBe("offline");
    expect(alpha.presence.product).toBeNull();
    expect(alpha.presence.valorant).toBeNull();
    expect(alpha.note).toBe("Old friend");
  });
});
