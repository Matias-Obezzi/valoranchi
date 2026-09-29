import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import {
  RankResolver,
  resolveAgent,
  resolveCard,
  resolveMap,
  resolveSeasonName,
  resolveTitle,
} from "../src/collection/RankResolver.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

describe("RankResolver", () => {
  const catalogue = new Catalogue(catalogueData);
  const resolver = new RankResolver(catalogue);

  it("resolves tier 0 as Unranked with null division and icon", () => {
    const unranked = resolver.fromTier(0, 0);
    expect(unranked).toEqual({
      tier: 0,
      name: "Unranked",
      division: null,
      icon: null,
      rating: 0,
    });
  });

  it("resolves known tier with name, division, and icon", () => {
    const rank = resolver.fromTier(3, 75);
    expect(rank).toEqual({
      tier: 3,
      name: "Iron 3",
      division: "Iron",
      icon: "https://media.valorant-api.com/competitivetiers/iron3_large.png",
      rating: 75,
    });
  });

  it("returns null for null or undefined tier", () => {
    expect(resolver.fromTier(null)).toBeNull();
    expect(resolver.fromTier(undefined)).toBeNull();
  });

  it("resolves season names with parent episode when available", () => {
    expect(resolveSeasonName(catalogue, "season-act-1")).toBe("ACT 1");
    expect(resolveSeasonName(catalogue, "unknown-season")).toBeNull();
    expect(resolveSeasonName(catalogue, null)).toBeNull();
  });

  it("resolves map with uuid, name and path", () => {
    const resolved = resolveMap(catalogue, "/Game/Maps/Ascent/Ascent");
    expect(resolved).toEqual({
      uuid: "map-1",
      name: "Ascent",
      path: "/Game/Maps/Ascent/Ascent",
    });

    const unknown = resolveMap(catalogue, "/Game/Maps/Unknown/Unknown");
    expect(unknown).toEqual({
      uuid: null,
      name: null,
      path: "/Game/Maps/Unknown/Unknown",
    });
  });

  it("resolves agent or returns null for empty/zero uuid", () => {
    expect(resolveAgent(catalogue, null)).toBeNull();
    expect(resolveAgent(catalogue, "00000000-0000-0000-0000-000000000000")).toBeNull();

    const unknown = resolveAgent(catalogue, "unknown-uuid");
    expect(unknown).toEqual({
      uuid: "unknown-uuid",
      name: "",
      icon: null,
      role: null,
    });
  });

  it("resolves cards and titles", () => {
    expect(resolveCard(catalogue, "33cd272d-4860-9118-2e06-95bb39ad0419")?.name).toBe(
      "Duelist Card",
    );
    expect(resolveCard(catalogue, null)).toBeNull();
    expect(resolveTitle(catalogue, "7a85e65d-4f11-c918-0929-c7931f6087d1")?.text).toBe("Champion");
    expect(resolveTitle(catalogue, null)).toBeNull();
  });
});
