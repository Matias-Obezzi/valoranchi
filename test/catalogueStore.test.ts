import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileCatalogueStore } from "../src/catalogue/CatalogueStore.js";
import { MemoryCatalogueCache, ValorantApi } from "../src/catalogue/ValorantApi.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import type { HttpGateway } from "../src/riot/HttpGateway.js";

const sampleData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

const versionResponse = { status: 200, data: { riotClientVersion: "release-10.00-1" } };

function gatewayServing(version = versionResponse) {
  return vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith("/version")) return version;
    const endpoint = url.split("/v1/")[1]!.split("?")[0] as keyof ValorantApiCatalogueData;
    return { status: 200, data: sampleData[endpoint] };
  });
}

describe("FileCatalogueStore", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riot-client-catalogue-"));
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("round-trips a catalogue per language and returns null for unknown ones", () => {
    const store = new FileCatalogueStore(dir);
    store.write("es-ES", { version: "v1", data: sampleData });

    expect(store.read("es-ES")).toEqual({ version: "v1", data: sampleData });
    expect(store.read("en-US")).toBeNull();
  });

  it("serves the catalogue from disk when the version matches and refetches when it does not", async () => {
    const store = new FileCatalogueStore(dir);
    store.write("en-US", { version: "release-10.00-1", data: sampleData });

    const fresh = gatewayServing();
    const api = new ValorantApi(
      { get: fresh } as unknown as HttpGateway,
      new MemoryCatalogueCache(),
      store,
    );
    const catalogue = await api.getCatalogue("en-US");
    const first = sampleData.weapons[0]!;
    expect(catalogue.getWeapon(first.uuid)?.displayName).toBe(first.displayName);
    expect(fresh).toHaveBeenCalledTimes(1);

    const newer = gatewayServing({ status: 200, data: { riotClientVersion: "release-10.01-1" } });
    const stale = new ValorantApi(
      { get: newer } as unknown as HttpGateway,
      new MemoryCatalogueCache(),
      store,
    );
    await stale.getCatalogue("en-US");
    expect(newer).toHaveBeenCalledTimes(9);
    expect(store.read("en-US")?.version).toBe("release-10.01-1");
  });
});
