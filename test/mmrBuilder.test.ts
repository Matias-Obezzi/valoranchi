import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { MmrBuilder } from "../src/collection/MmrBuilder.js";
import type { RiotCompetitiveUpdate, RiotMmrResponse } from "../src/riot/types.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

const rawMmr = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "mmr.json"), "utf-8"),
) as RiotMmrResponse;

describe("MmrBuilder", () => {
  const catalogue = new Catalogue(catalogueData);

  it("resolves current rank from LatestCompetitiveUpdate when in same act", () => {
    const builder = new MmrBuilder(catalogue);
    const mmr = builder.buildMmr(rawMmr);

    expect(mmr.current).toEqual({
      tier: 3,
      name: "Iron 3",
      division: "Iron",
      icon: "https://media.valorant-api.com/competitivetiers/iron3_large.png",
      rating: 75,
    });
    expect(mmr.act).toEqual({
      uuid: "season-act-1",
      name: "ACT 1",
      games: 25,
      wins: 15,
      gamesNeededForRating: 0,
    });
    expect(mmr.lastUpdate).toEqual({
      matchId: "match-update-1",
      at: new Date(1700000000000).toISOString(),
      before: {
        tier: 3,
        name: "Iron 3",
        division: "Iron",
        icon: "https://media.valorant-api.com/competitivetiers/iron3_large.png",
        rating: 55,
      },
      after: {
        tier: 3,
        name: "Iron 3",
        division: "Iron",
        icon: "https://media.valorant-api.com/competitivetiers/iron3_large.png",
        rating: 75,
      },
      earned: 20,
      movement: "INCREASE",
    });
  });

  it("resolves current rank from seasonal info when latest update is not in current act", () => {
    const builder = new MmrBuilder(catalogue);
    const modifiedMmr: RiotMmrResponse = {
      ...rawMmr,
      LatestCompetitiveUpdate: {
        ...rawMmr.LatestCompetitiveUpdate!,
        SeasonID: "past-season",
      },
    };
    const mmr = builder.buildMmr(modifiedMmr);

    expect(mmr.current?.tier).toBe(3);
    expect(mmr.current?.rating).toBe(75);
  });

  it("resolves peak rank from WinsByTier across all seasons", () => {
    const builder = new MmrBuilder(catalogue);
    const mmr = builder.buildMmr(rawMmr);

    expect(mmr.peak?.tier).toBe(4);
    expect(mmr.peak?.act.uuid).toBe("season-act-old");
  });

  it("handles unranked players with tier 0", () => {
    const builder = new MmrBuilder(catalogue);
    const emptyMmr: RiotMmrResponse = {
      Subject: "new-user",
      Version: 1,
      QueueSkills: {},
    };
    const mmr = builder.buildMmr(emptyMmr);

    expect(mmr.current).toEqual({
      tier: 0,
      name: "Unranked",
      division: null,
      icon: null,
      rating: null,
    });
    expect(mmr.peak).toBeNull();
    expect(mmr.lastUpdate).toBeNull();
  });

  it("builds rank changes from competitive updates", () => {
    const builder = new MmrBuilder(catalogue);
    const updates: RiotCompetitiveUpdate[] = [rawMmr.LatestCompetitiveUpdate!];
    const changes = builder.buildRankChanges(updates);

    expect(changes).toHaveLength(1);
    expect(changes[0]!).toEqual({
      matchId: "match-update-1",
      at: new Date(1700000000000).toISOString(),
      map: {
        name: "Ascent",
        path: "/Game/Maps/Ascent/Ascent",
      },
      before: {
        tier: 3,
        name: "Iron 3",
        division: "Iron",
        icon: "https://media.valorant-api.com/competitivetiers/iron3_large.png",
        rating: 55,
      },
      after: {
        tier: 3,
        name: "Iron 3",
        division: "Iron",
        icon: "https://media.valorant-api.com/competitivetiers/iron3_large.png",
        rating: 75,
      },
      earned: 20,
      bonus: 2,
      movement: "INCREASE",
      afkPenalty: 0,
    });
  });
});
