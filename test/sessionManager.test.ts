import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { ValorantApi } from "../src/catalogue/ValorantApi.js";
import { SessionManager } from "../src/client/SessionManager.js";
import { RiotClientNotRunningError } from "../src/errors.js";
import type { RiotClientLocalApi } from "../src/local/RiotClientLocalApi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("SessionManager", () => {
  const createMockValorantApi = () =>
    ({
      getClientVersion: async () => "release-1.0.0",
    }) as unknown as ValorantApi;

  it("throws RiotClientNotRunningError when lockfile is missing", async () => {
    const manager = new SessionManager({
      lockfilePath: "non-existent-lockfile-path",
      valorantApi: createMockValorantApi(),
    });

    expect(manager.credentials()).toBeNull();
    expect(() => manager.localApi()).toThrow(RiotClientNotRunningError);
    await expect(manager.session()).rejects.toThrow(RiotClientNotRunningError);
  });

  it("returns credentials when lockfile is present", () => {
    const tempDir = path.join(__dirname, "tmp-test-sm-cred");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const lockfilePath = path.join(tempDir, "lockfile");
    fs.writeFileSync(lockfilePath, "Riot Client:100:1234:secret_pass");

    try {
      const manager = new SessionManager({
        lockfilePath,
        valorantApi: createMockValorantApi(),
      });

      expect(manager.credentials()).toEqual({
        port: 1234,
        password: "secret_pass",
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("caches session and deduplicates concurrent session creation", async () => {
    const tempDir = path.join(__dirname, "tmp-test-sm-dedup");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const lockfilePath = path.join(tempDir, "lockfile");
    fs.writeFileSync(lockfilePath, "Riot Client:100:200:test_password");

    let createCalls = 0;
    const mockLocalApi = {
      entitlementsToken: async () => {
        createCalls++;
        await new Promise((r) => setTimeout(r, 20));
        return { accessToken: "access", token: "token", subject: "puuid-1" };
      },
      valorantSession: async () => ({ region: "na", shard: "na" }),
      close: async () => undefined,
    } as unknown as RiotClientLocalApi;

    try {
      const manager = new SessionManager({
        lockfilePath,
        sessionTtlMs: 5000,
        valorantApi: createMockValorantApi(),
        localApiFactory: () => mockLocalApi,
      });

      const [s1, s2] = await Promise.all([manager.session(), manager.session()]);
      expect(s1).toBe(s2);
      expect(createCalls).toBe(1);
      expect(s1.puuid).toBe("puuid-1");

      const s3 = await manager.session();
      expect(s3).toBe(s1);
      expect(createCalls).toBe(1);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("expires cached session after sessionTtlMs", async () => {
    const tempDir = path.join(__dirname, "tmp-test-sm-ttl");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const lockfilePath = path.join(tempDir, "lockfile");
    fs.writeFileSync(lockfilePath, "Riot Client:100:200:test_password");

    let createCalls = 0;
    const mockLocalApi = {
      entitlementsToken: async () => {
        createCalls++;
        return { accessToken: `access-${createCalls}`, token: "token", subject: "puuid-1" };
      },
      valorantSession: async () => ({ region: "na", shard: "na" }),
      close: async () => undefined,
    } as unknown as RiotClientLocalApi;

    try {
      const manager = new SessionManager({
        lockfilePath,
        sessionTtlMs: 50,
        valorantApi: createMockValorantApi(),
        localApiFactory: () => mockLocalApi,
      });

      const s1 = await manager.session();
      expect(s1.accessToken).toBe("access-1");
      expect(createCalls).toBe(1);

      await new Promise((r) => setTimeout(r, 60));

      const s2 = await manager.session();
      expect(s2.accessToken).toBe("access-2");
      expect(createCalls).toBe(2);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("caches localApi and replaces it when lockfile changes", async () => {
    const tempDir = path.join(__dirname, "tmp-test-sm-local");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const lockfilePath = path.join(tempDir, "lockfile");
    fs.writeFileSync(lockfilePath, "Riot Client:100:1001:pass1");

    const closedApis: string[] = [];
    const factory = vi.fn((port: number, pass: string) => {
      const id = `${port}:${pass}`;
      return {
        port,
        pass,
        close: async () => {
          closedApis.push(id);
        },
      } as unknown as RiotClientLocalApi;
    });

    try {
      const manager = new SessionManager({
        lockfilePath,
        valorantApi: createMockValorantApi(),
        localApiFactory: factory,
      });

      const api1 = manager.localApi();
      const api2 = manager.localApi();
      expect(api1).toBe(api2);
      expect(factory).toHaveBeenCalledTimes(1);

      fs.writeFileSync(lockfilePath, "Riot Client:100:1002:pass2");

      const api3 = manager.localApi();
      expect(api3).not.toBe(api1);
      expect(factory).toHaveBeenCalledTimes(2);
      expect(closedApis).toEqual(["1001:pass1"]);

      await manager.close();
      expect(closedApis).toEqual(["1001:pass1", "1002:pass2"]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
