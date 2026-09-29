import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { PartyBuilder } from "../src/collection/PartyBuilder.js";
import type { RiotPartyResponse } from "../src/riot/types.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

describe("PartyBuilder", () => {
  const catalogue = new Catalogue(catalogueData);

  it("builds party model with members and accessibility", () => {
    const builder = new PartyBuilder(catalogue);
    const rawParty: RiotPartyResponse = {
      ID: "party-123",
      State: "DEFAULT",
      Accessibility: "OPEN",
      MatchmakingData: {
        QueueID: "competitive",
      },
      InviteCode: "INV123",
      QueueEntryTime: "2026-09-29T00:00:00.000Z",
      Members: [
        {
          Subject: "leader-puuid",
          CompetitiveTier: 3,
          IsOwner: true,
          IsReady: true,
          PlayerIdentity: {
            PlayerCardID: "33cd272d-4860-9118-2e06-95bb39ad0419",
            PlayerTitleID: "7a85e65d-4f11-c918-0929-c7931f6087d1",
            AccountLevel: 60,
            Incognito: false,
          },
        },
        {
          Subject: "member-puuid",
          CompetitiveTier: 0,
          IsOwner: false,
          IsReady: false,
          PlayerIdentity: {
            AccountLevel: 25,
            Incognito: true,
          },
        },
      ],
    };

    const names = new Map([
      ["leader-puuid", { gameName: "Leader", tagLine: "WIN" }],
      ["member-puuid", { gameName: "Member", tagLine: "CHILL" }],
    ]);

    const party = builder.build(rawParty, names);
    expect(party).toEqual({
      id: "party-123",
      state: "DEFAULT",
      accessibility: "open",
      queue: "competitive",
      inviteCode: "INV123",
      queueEnteredAt: "2026-09-29T00:00:00.000Z",
      members: [
        {
          puuid: "leader-puuid",
          gameName: "Leader",
          tagLine: "WIN",
          owner: true,
          ready: true,
          rank: {
            tier: 3,
            name: "Iron 3",
            division: "Iron",
            icon: "https://media.valorant-api.com/competitivetiers/iron3_large.png",
            rating: null,
          },
          accountLevel: 60,
          card: {
            uuid: "33cd272d-4860-9118-2e06-95bb39ad0419",
            name: "Duelist Card",
            small: "https://media.valorant-api.com/playercards/small.png",
            wide: "https://media.valorant-api.com/playercards/wide.png",
            large: "https://media.valorant-api.com/playercards/large.png",
          },
          title: {
            uuid: "7a85e65d-4f11-c918-0929-c7931f6087d1",
            name: "Champion",
            text: "Champion",
          },
          incognito: false,
        },
        {
          puuid: "member-puuid",
          gameName: "Member",
          tagLine: "CHILL",
          owner: false,
          ready: false,
          rank: {
            tier: 0,
            name: "Unranked",
            division: null,
            icon: null,
            rating: null,
          },
          accountLevel: 25,
          card: null,
          title: null,
          incognito: true,
        },
      ],
    });
  });
});
