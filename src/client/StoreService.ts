import { CollectionBuilder } from "../collection/CollectionBuilder.js";
import { StoreBuilder } from "../collection/StoreBuilder.js";
import { StoreOffersBuilder } from "../collection/StoreOffersBuilder.js";
import type {
  Offer,
  Order,
  OwnedItems,
  Store,
  StoreHistory,
  StoreSeen,
  Wallet,
} from "../model/index.js";
import {
  loadStoreHistory,
  querySkinSeen,
  recordStoreRotation,
  saveStoreHistory,
} from "../analysis/storeHistory.js";
import { defaultResponseCacheDir } from "../riot/ResponseCache.js";
import { CURRENCY_UUIDS } from "../riot/types.js";
import type { StoreApi } from "./api.js";
import type { ClientContext } from "./ClientContext.js";
import { StoreValidator, type BuyTarget, type BuyValidationResult } from "./StoreValidator.js";

export class StoreService implements StoreApi {
  constructor(private readonly context: ClientContext) {}

  async current(options?: { language?: string }): Promise<Store> {
    const lang = options?.language ?? this.context.language;
    const session = await this.context.sessions.session();
    const api = this.context.api(session);

    const [player, rawStorefront, catalogue] = await Promise.all([
      this.context.player(session),
      api.storefront(),
      this.context.catalogue(lang),
    ]);

    const store = new StoreBuilder(player, rawStorefront, catalogue, Date.now()).build();
    try {
      const cacheDir = this.context.cacheDir ?? defaultResponseCacheDir();
      const history = loadStoreHistory(cacheDir, player.puuid);
      const updated = recordStoreRotation(history, store);
      saveStoreHistory(cacheDir, player.puuid, updated);
    } catch {}
    return store;
  }

  async offers(): Promise<Offer[]> {
    const session = await this.context.sessions.session();
    const [raw, catalogue] = await Promise.all([
      this.context.api(session).offers(),
      this.context.catalogue(),
    ]);
    return new StoreOffersBuilder(catalogue).buildOffers(raw);
  }

  async validateRevealNightMarket(): Promise<{ url: string }> {
    const current = await this.current();
    StoreValidator.validateNightMarket(current);
    const session = await this.context.sessions.session();
    return {
      url: `${session.endpoints.pd}/store/v2/storefront/${session.puuid}/nightmarket/offers`,
    };
  }

  async revealNightMarket(): Promise<Store> {
    await this.validateRevealNightMarket();
    const session = await this.context.sessions.session();
    await this.context.api(session).revealNightMarket();
    return this.current();
  }

  async validateBuy(
    target: BuyTarget,
    options?: { confirm?: boolean },
  ): Promise<BuyValidationResult> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [store, owned, rawWallet] = await Promise.all([
      this.current(),
      this.fetchOwnedItems(),
      api.wallet(),
    ]);

    const wallet: Wallet = {
      valorantPoints: rawWallet.Balances?.[CURRENCY_UUIDS.valorantPoints] ?? 0,
      radianite: rawWallet.Balances?.[CURRENCY_UUIDS.radianite] ?? 0,
      kingdomCredits: rawWallet.Balances?.[CURRENCY_UUIDS.kingdomCredits] ?? 0,
    };

    return StoreValidator.validateBuy(store, owned, wallet, target, options?.confirm);
  }

  async buy(target: BuyTarget, options?: { confirm?: boolean }): Promise<Order> {
    const validated = await this.validateBuy(target, options);
    const session = await this.context.sessions.session();
    const api = this.context.api(session);

    const rawOrder =
      validated.type === "offer"
        ? await api.createOrder(validated.payload)
        : await api.createBundleOrder(validated.bundleId, validated.payload);

    const catalogue = await this.context.catalogue();
    return new StoreOffersBuilder(catalogue).buildOrder(rawOrder);
  }

  async history(options?: { days?: number }): Promise<StoreHistory> {
    const session = await this.context.sessions.session();
    const cacheDir = this.context.cacheDir ?? defaultResponseCacheDir();
    const history = loadStoreHistory(cacheDir, session.puuid);
    if (options?.days !== undefined && options.days > 0) {
      return { days: history.days.slice(-options.days) };
    }
    return history;
  }

  async seen(skin: string): Promise<StoreSeen> {
    const [session, catalogue] = await Promise.all([
      this.context.sessions.session(),
      this.context.catalogue(),
    ]);
    const skinEntity = catalogue.findSkin(skin);
    const skinUuid = skinEntity?.uuid ?? skin;
    const cacheDir = this.context.cacheDir ?? defaultResponseCacheDir();
    const history = loadStoreHistory(cacheDir, session.puuid);
    return querySkinSeen(history, skinUuid);
  }

  async order(id: string): Promise<Order> {
    const session = await this.context.sessions.session();
    const [rawOrder, catalogue] = await Promise.all([
      this.context.api(session).order(id),
      this.context.catalogue(),
    ]);
    return new StoreOffersBuilder(catalogue).buildOrder(rawOrder);
  }

  private async fetchOwnedItems(): Promise<OwnedItems> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [player, entitlements, catalogue] = await Promise.all([
      this.context.player(session),
      api.entitlements(),
      this.context.catalogue(),
    ]);
    return new CollectionBuilder(player, entitlements, catalogue, this.context.language).build();
  }
}
