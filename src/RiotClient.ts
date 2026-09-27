import { Catalogue } from "./catalogue/Catalogue.js";
import { ValorantApi } from "./catalogue/ValorantApi.js";
import { CollectionBuilder } from "./collection/CollectionBuilder.js";
import { RiotClientNotRunningError } from "./errors.js";
import { defaultLockfilePath, readLockfile } from "./local/Lockfile.js";
import { resolveRegion } from "./local/RegionResolver.js";
import { RiotClientLocalApi } from "./local/RiotClientLocalApi.js";
import type {
  Loadout,
  LoadoutGun,
  OwnedCard,
  OwnedItems,
  OwnedTitle,
  Player,
  Wallet,
} from "./model/index.js";
import { HttpGateway } from "./riot/HttpGateway.js";
import { RiotApi } from "./riot/RiotApi.js";
import { Session } from "./riot/Session.js";
import { CURRENCY_UUIDS, type RiotLoadoutGun, type RiotLoadoutResponse } from "./riot/types.js";

export interface RiotClientOptions {
  language?: string;
  lockfilePath?: string;
  sessionTtlMs?: number;
  gateway?: HttpGateway;
  valorantApi?: ValorantApi;
  localApiFactory?: (port: number, pass: string) => RiotClientLocalApi;
}

interface CachedSession {
  port: number;
  password: string;
  session: Session;
  createdAt: number;
}

export class RiotClient {
  private readonly language: string;
  private readonly lockfilePath: string | null;
  private readonly sessionTtlMs: number;
  private readonly gateway: HttpGateway;
  private readonly valorantApi: ValorantApi;
  private readonly localApiFactory: (port: number, pass: string) => RiotClientLocalApi;

  private cachedSession: CachedSession | null = null;
  private inFlightSession: Promise<Session> | null = null;

  constructor(options: RiotClientOptions = {}) {
    this.language = options.language ?? "en-US";
    this.lockfilePath = options.lockfilePath ?? defaultLockfilePath();
    this.sessionTtlMs = options.sessionTtlMs ?? 30_000;
    this.gateway = options.gateway ?? new HttpGateway();
    this.valorantApi = options.valorantApi ?? new ValorantApi(this.gateway);
    this.localApiFactory =
      options.localApiFactory ?? ((port, pass) => new RiotClientLocalApi(port, pass));
  }

  async whoami(): Promise<Player> {
    const session = await this.getSession();
    const riotApi = new RiotApi(this.gateway, session);
    const [names, loadout] = await Promise.all([
      riotApi.names([session.puuid]),
      riotApi.loadout(),
    ]);

    return {
      puuid: session.puuid,
      gameName: names[0]?.GameName ?? "",
      tagLine: names[0]?.TagLine ?? "",
      region: session.region,
      shard: session.shard,
      accountLevel: loadout.Identity?.AccountLevel ?? 0,
    };
  }

  async ownedItems(options?: { language?: string }): Promise<OwnedItems> {
    const lang = options?.language ?? this.language;
    const session = await this.getSession();
    const riotApi = new RiotApi(this.gateway, session);

    const [player, entitlements, catalogue] = await Promise.all([
      this.whoami(),
      riotApi.entitlements(),
      this.valorantApi.getCatalogue(lang),
    ]);

    return new CollectionBuilder(player, entitlements, catalogue, lang).build();
  }

  async loadout(): Promise<Loadout> {
    const session = await this.getSession();
    const riotApi = new RiotApi(this.gateway, session);

    const [player, rawLoadout, catalogue] = await Promise.all([
      this.whoami(),
      riotApi.loadout(),
      this.valorantApi.getCatalogue(this.language),
    ]);

    return this.buildLoadout(player, rawLoadout, catalogue);
  }

  async wallet(): Promise<Wallet> {
    const session = await this.getSession();
    const riotApi = new RiotApi(this.gateway, session);
    const rawWallet = await riotApi.wallet();
    const balances = rawWallet.Balances ?? {};

    return {
      valorantPoints: balances[CURRENCY_UUIDS.valorantPoints] ?? 0,
      radianite: balances[CURRENCY_UUIDS.radianite] ?? 0,
      kingdomCredits: balances[CURRENCY_UUIDS.kingdomCredits] ?? 0,
    };
  }

  async getSession(): Promise<Session> {
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

    this.inFlightSession = this.createSession(lockfile.port, lockfile.password)
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

  private async createSession(port: number, pass: string): Promise<Session> {
    const localApi = this.localApiFactory(port, pass);
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

  private buildLoadout(
    player: Player,
    raw: RiotLoadoutResponse,
    catalogue: Catalogue,
  ): Loadout {
    const guns: LoadoutGun[] = (raw.Guns ?? []).map((gun) => this.buildLoadoutGun(gun, catalogue));

    const sprays = (raw.Sprays ?? []).map((sp) => {
      const sprayEntity = catalogue.getSpray(sp.SprayID);
      return {
        slot: sp.EquipSlotID,
        uuid: sp.SprayID.toLowerCase(),
        name: sprayEntity?.displayName ?? "",
        icon: sprayEntity?.fullTransparentIcon ?? sprayEntity?.displayIcon ?? null,
      };
    });

    const cardEntity = raw.Identity?.PlayerCardID
      ? catalogue.getCard(raw.Identity.PlayerCardID)
      : null;
    const card: OwnedCard | null = cardEntity
      ? {
          uuid: cardEntity.uuid.toLowerCase(),
          name: cardEntity.displayName,
          small: cardEntity.smallArt,
          wide: cardEntity.wideArt,
          large: cardEntity.largeArt,
        }
      : null;

    const titleEntity = raw.Identity?.PlayerTitleID
      ? catalogue.getTitle(raw.Identity.PlayerTitleID)
      : null;
    const title: OwnedTitle | null = titleEntity
      ? {
          uuid: titleEntity.uuid.toLowerCase(),
          name: titleEntity.displayName,
          text: titleEntity.titleText,
        }
      : null;

    return {
      player,
      guns,
      sprays,
      card,
      title,
      incognito: Boolean(raw.Incognito),
    };
  }

  private buildLoadoutGun(gun: RiotLoadoutGun, catalogue: Catalogue): LoadoutGun {
    const weapon = catalogue.getWeapon(gun.ID);
    const skin = catalogue.getSkin(gun.SkinID);
    const levelMatch = catalogue.findSkinAndWeaponByLevel(gun.SkinLevelID);
    const chromaMatch = catalogue.findSkinAndWeaponByChroma(gun.ChromaID);

    let buddy: { uuid: string; name: string; icon: string | null } | null = null;
    if (gun.CharmID) {
      const buddyEntity = catalogue.getBuddy(gun.CharmID);
      if (buddyEntity) {
        buddy = {
          uuid: buddyEntity.uuid.toLowerCase(),
          name: buddyEntity.displayName,
          icon: buddyEntity.displayIcon,
        };
      }
    } else if (gun.CharmLevelID) {
      const levelMatch = catalogue.findBuddyByLevel(gun.CharmLevelID);
      if (levelMatch) {
        buddy = {
          uuid: levelMatch.buddy.uuid.toLowerCase(),
          name: levelMatch.buddy.displayName,
          icon: levelMatch.buddy.displayIcon,
        };
      }
    }

    return {
      weapon: {
        uuid: gun.ID.toLowerCase(),
        name: weapon?.displayName ?? "",
      },
      skin: {
        uuid: gun.SkinID.toLowerCase(),
        name: skin?.displayName ?? "",
        icon: skin?.displayIcon ?? null,
      },
      level: {
        uuid: gun.SkinLevelID.toLowerCase(),
        name: levelMatch?.level.displayName ?? "",
      },
      chroma: {
        uuid: gun.ChromaID.toLowerCase(),
        name: chromaMatch?.chroma.displayName ?? "",
      },
      buddy,
    };
  }
}
