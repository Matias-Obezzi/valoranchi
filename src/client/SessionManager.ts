import type { ValorantApi } from "../catalogue/ValorantApi.js";
import { RiotClientNotRunningError } from "../errors.js";
import { defaultLockfilePath, readLockfile } from "../local/Lockfile.js";
import { resolveRegion } from "../local/RegionResolver.js";
import { RiotClientLocalApi } from "../local/RiotClientLocalApi.js";
import { Session } from "../riot/Session.js";

export interface SessionManagerOptions {
  lockfilePath?: string | null;
  sessionTtlMs?: number;
  valorantApi: ValorantApi;
  localApiFactory?: (port: number, pass: string) => RiotClientLocalApi;
}

interface CachedSession {
  port: number;
  password: string;
  session: Session;
  createdAt: number;
}

interface CachedLocalApi {
  port: number;
  password: string;
  api: RiotClientLocalApi;
}

export class SessionManager {
  private readonly lockfilePath: string | null;
  private readonly sessionTtlMs: number;
  private readonly valorantApi: ValorantApi;
  private readonly localApiFactory: (port: number, pass: string) => RiotClientLocalApi;

  private cachedSession: CachedSession | null = null;
  private inFlightSession: Promise<Session> | null = null;
  private cachedLocalApi: CachedLocalApi | null = null;

  constructor(options: SessionManagerOptions) {
    this.lockfilePath = options.lockfilePath ?? defaultLockfilePath();
    this.sessionTtlMs = options.sessionTtlMs ?? 30_000;
    this.valorantApi = options.valorantApi;
    this.localApiFactory =
      options.localApiFactory ?? ((port, pass) => new RiotClientLocalApi(port, pass));
  }

  credentials(): { port: number; password: string } | null {
    const lockfile = readLockfile(this.lockfilePath);
    if (!lockfile) {
      return null;
    }
    return { port: lockfile.port, password: lockfile.password };
  }

  localApi(): RiotClientLocalApi {
    const lockfile = readLockfile(this.lockfilePath);
    if (!lockfile) {
      throw new RiotClientNotRunningError();
    }

    if (
      this.cachedLocalApi &&
      this.cachedLocalApi.port === lockfile.port &&
      this.cachedLocalApi.password === lockfile.password
    ) {
      return this.cachedLocalApi.api;
    }

    if (this.cachedLocalApi) {
      void this.cachedLocalApi.api.close();
      this.cachedLocalApi = null;
    }

    const api = this.localApiFactory(lockfile.port, lockfile.password);
    this.cachedLocalApi = {
      port: lockfile.port,
      password: lockfile.password,
      api,
    };
    return api;
  }

  async session(): Promise<Session> {
    const lockfile = readLockfile(this.lockfilePath);
    if (!lockfile) {
      throw new RiotClientNotRunningError();
    }

    if (
      this.cachedSession &&
      this.cachedSession.port === lockfile.port &&
      this.cachedSession.password === lockfile.password &&
      Date.now() - this.cachedSession.createdAt < this.sessionTtlMs
    ) {
      return this.cachedSession.session;
    }

    if (this.inFlightSession) {
      return this.inFlightSession;
    }

    this.inFlightSession = this.createSession()
      .then((session) => {
        this.cachedSession = {
          port: lockfile.port,
          password: lockfile.password,
          session,
          createdAt: Date.now(),
        };
        return session;
      })
      .finally(() => {
        this.inFlightSession = null;
      });

    return this.inFlightSession;
  }

  async close(): Promise<void> {
    this.cachedSession = null;
    if (this.cachedLocalApi) {
      const api = this.cachedLocalApi.api;
      this.cachedLocalApi = null;
      await api.close();
    }
  }

  private async createSession(): Promise<Session> {
    const localApi = this.localApi();
    const [tokens, regionInfo, clientVersion] = await Promise.all([
      localApi.entitlementsToken(),
      resolveRegion(localApi),
      this.valorantApi.getClientVersion(),
    ]);

    return new Session({
      puuid: tokens.subject,
      accessToken: tokens.accessToken,
      entitlementsToken: tokens.token,
      region: regionInfo.region,
      shard: regionInfo.shard,
      clientVersion,
    });
  }
}
