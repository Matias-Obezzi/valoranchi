import { FileCatalogueStore } from "./catalogue/CatalogueStore.js";
import { MemoryCatalogueCache, ValorantApi } from "./catalogue/ValorantApi.js";
import { AccountService } from "./client/AccountService.js";
import type {
  AccountApi,
  MatchesApi,
  PartyApi,
  SocialApi,
  StoreApi,
} from "./client/api.js";
import { createPlayer, type ClientContext } from "./client/ClientContext.js";
import { EventsService } from "./client/EventsService.js";
import type { LoadoutChange, LoadoutGunChange } from "./client/LoadoutValidator.js";
import { MatchService } from "./client/MatchService.js";
import { PartyService } from "./client/PartyService.js";
import type { PartyActionRequest } from "./client/PartyValidator.js";
import { SessionManager } from "./client/SessionManager.js";
import { SocialService } from "./client/SocialService.js";
import { StoreService } from "./client/StoreService.js";
import type { RiotEvents } from "./events/RiotEvents.js";
import type { RiotClientLocalApi } from "./local/RiotClientLocalApi.js";
import { HttpGateway } from "./riot/HttpGateway.js";
import { FileResponseCache } from "./riot/ResponseCache.js";
import { RiotApi } from "./riot/RiotApi.js";
import type { Session } from "./riot/Session.js";

export type { LoadoutChange, LoadoutGunChange, PartyActionRequest };

export interface RiotClientOptions {
  language?: string;
  lockfilePath?: string;
  sessionTtlMs?: number;
  catalogueDir?: string | null;
  responseCache?: { ttlMs: number; dir?: string };
  gateway?: HttpGateway;
  valorantApi?: ValorantApi;
  localApiFactory?: (port: number, pass: string) => RiotClientLocalApi;
}

export class RiotClient {
  readonly account: AccountApi;
  readonly social: SocialApi;
  readonly store: StoreApi;
  readonly matches: MatchesApi;
  readonly party: PartyApi;

  private readonly sessions: SessionManager;
  private readonly eventsService: EventsService;

  constructor(options: RiotClientOptions = {}) {
    const language = options.language ?? "en-US";
    const gateway = options.gateway ?? new HttpGateway();
    const store =
      options.catalogueDir === null ? null : new FileCatalogueStore(options.catalogueDir);
    const valorantApi =
      options.valorantApi ?? new ValorantApi(gateway, new MemoryCatalogueCache(), store);
    const responseCache = options.responseCache
      ? new FileResponseCache(options.responseCache.ttlMs, options.responseCache.dir)
      : null;

    this.sessions = new SessionManager({
      lockfilePath: options.lockfilePath,
      sessionTtlMs: options.sessionTtlMs,
      valorantApi,
      localApiFactory: options.localApiFactory,
    });

    const api = (session: Session) => new RiotApi(gateway, session, responseCache);
    const context: ClientContext = {
      language,
      sessions: this.sessions,
      valorantApi,
      api,
      catalogue: (lang?: string) => valorantApi.getCatalogue(lang ?? language),
      player: (session: Session) => createPlayer(api(session), session),
    };

    this.account = new AccountService(context);
    this.social = new SocialService(context);
    this.store = new StoreService(context);
    this.matches = new MatchService(context);
    this.party = new PartyService(context);
    this.eventsService = new EventsService(context);
  }

  events(): RiotEvents {
    return this.eventsService.events();
  }

  async close(): Promise<void> {
    this.eventsService.close();
    await this.sessions.close();
  }
}
