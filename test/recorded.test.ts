import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { CollectionBuilder } from "../src/collection/CollectionBuilder.js";
import { FriendsBuilder } from "../src/collection/FriendsBuilder.js";
import { LoadoutBuilder } from "../src/collection/LoadoutBuilder.js";
import { MatchBuilder } from "../src/collection/MatchBuilder.js";
import { MessagesBuilder } from "../src/collection/MessagesBuilder.js";
import { MmrBuilder } from "../src/collection/MmrBuilder.js";
import { StoreBuilder } from "../src/collection/StoreBuilder.js";
import type {
  RawChatFriend,
  RawChatMessage,
  RawChatPresence,
  RawChatSession,
} from "../src/local/chatTypes.js";
import type { Player } from "../src/model/index.js";
import type {
  RiotCompetitiveUpdatesResponse,
  RiotEntitlementsResponse,
  RiotLoadoutResponse,
  RiotMatchDetailsResponse,
  RiotMmrResponse,
  RiotStorefrontResponse,
} from "../src/riot/types.js";

const dir = path.join(import.meta.dirname, "fixtures", "recorded");
const catalogue = new Catalogue(
  JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
  ) as ValorantApiCatalogueData,
);

function recorded<T>(name: string): { self: string; raw: T } | null {
  const file = path.join(dir, `${name}.json`);
  return fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, "utf-8")) as { self: string; raw: T })
    : null;
}

function player(self: string): Player {
  return {
    puuid: self,
    gameName: "Player1",
    tagLine: "TAG",
    region: "na",
    shard: "na",
    accountLevel: 1,
  };
}

const fixtures = fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => f.replace(/\.json$/, "")) : [];

describe.skipIf(fixtures.length === 0)(
  "recorded Riot payloads build the same models as when recorded",
  () => {
    const has = (name: string) => fixtures.includes(name);

    it.skipIf(!has("loadout"))("loadout", () => {
      const { self, raw } = recorded<RiotLoadoutResponse>("loadout")!;
      expect(new LoadoutBuilder(player(self), raw, catalogue).build()).toMatchSnapshot();
    });

    it.skipIf(!has("entitlements"))("owned items", () => {
      const { self, raw } = recorded<RiotEntitlementsResponse>("entitlements")!;
      expect(
        new CollectionBuilder(player(self), raw, catalogue).build(new Date("2026-01-01T00:00:00Z")),
      ).toMatchSnapshot();
    });

    it.skipIf(!has("storefront"))("store", () => {
      const { self, raw } = recorded<RiotStorefrontResponse>("storefront")!;
      expect(
        new StoreBuilder(player(self), raw, catalogue, new Date("2026-01-01T00:00:00Z")).build(),
      ).toMatchSnapshot();
    });

    it.skipIf(!has("mmr"))("mmr and rank history", () => {
      const { raw } = recorded<RiotMmrResponse>("mmr")!;
      const updates =
        recorded<RiotCompetitiveUpdatesResponse>("competitiveUpdates")?.raw.Matches ?? [];
      const builder = new MmrBuilder(catalogue);
      expect(builder.buildMmr(raw, updates)).toMatchSnapshot();
      expect(builder.buildRankChanges(updates)).toMatchSnapshot();
    });

    it.skipIf(!has("matchDetails"))("match", () => {
      const { self, raw } = recorded<RiotMatchDetailsResponse>("matchDetails")!;
      expect(new MatchBuilder(raw, catalogue, self).build()).toMatchSnapshot();
    });

    it.skipIf(!has("friends"))("friends", () => {
      const friends = recorded<RawChatFriend[]>("friends")!.raw;
      const presences = recorded<RawChatPresence[]>("presences")?.raw ?? [];
      expect(new FriendsBuilder(friends, presences, catalogue).build()).toMatchSnapshot();
    });

    it.skipIf(!has("messages"))("messages", () => {
      const messages = recorded<RawChatMessage[]>("messages")!.raw;
      const session = recorded<RawChatSession | null>("chatSession")?.raw ?? null;
      expect(new MessagesBuilder([], session).buildMessages(messages)).toMatchSnapshot();
    });
  },
);
