import type { Catalogue } from "../catalogue/Catalogue.js";
import type {
  AccessoryOffer,
  Bundle,
  Cost,
  DailyOffer,
  NightMarketOffer,
  Player,
  RadianiteOffer,
  Store,
} from "../model/index.js";
import type {
  RiotAccessoryStore,
  RiotBonusStore,
  RiotFeaturedBundle,
  RiotSkinsPanelLayout,
  RiotStorefrontResponse,
  RiotUpgradeCurrencyStore,
} from "../riot/types.js";
import { StoreItemResolver } from "./StoreItemResolver.js";

export class StoreBuilder {
  private readonly player: Player;
  private readonly raw: RiotStorefrontResponse;
  private readonly catalogue: Catalogue;
  private readonly fetchedAtMs: number;
  private readonly resolver: StoreItemResolver;

  constructor(
    player: Player,
    raw: RiotStorefrontResponse,
    catalogue: Catalogue,
    fetchedAt: Date | number | string = Date.now(),
  ) {
    this.player = player;
    this.raw = raw;
    this.catalogue = catalogue;
    this.fetchedAtMs =
      typeof fetchedAt === "number"
        ? fetchedAt
        : fetchedAt instanceof Date
          ? fetchedAt.getTime()
          : new Date(fetchedAt).getTime();
    this.resolver = new StoreItemResolver(catalogue);
  }

  build(): Store {
    return {
      player: this.player,
      fetchedAt: new Date(this.fetchedAtMs).toISOString(),
      daily: this.buildDaily(this.raw.SkinsPanelLayout),
      nightMarket: this.buildNightMarket(this.raw.BonusStore),
      bundles: this.buildBundles(this.raw.FeaturedBundle),
      accessories: this.buildAccessories(this.raw.AccessoryStore),
      radianite: this.buildRadianite(this.raw.UpgradeCurrencyStore),
    };
  }

  private deadline(durationSeconds: number | null | undefined): string | null {
    if (
      typeof durationSeconds !== "number" ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0
    ) {
      return null;
    }
    return new Date(this.fetchedAtMs + durationSeconds * 1000).toISOString();
  }

  private parseCost(costMap?: Record<string, number> | null): Cost {
    if (!costMap) {
      return { currency: "", currencyUuid: "", amount: 0 };
    }
    const entries = Object.entries(costMap);
    if (entries.length === 0) {
      return { currency: "", currencyUuid: "", amount: 0 };
    }
    const [currencyUuid, amount] = entries[0]!;
    const currency = this.catalogue.getCurrency(currencyUuid);
    return {
      currency: currency?.displayName ?? currencyUuid,
      currencyUuid: currencyUuid.toLowerCase(),
      amount,
    };
  }

  private buildDaily(
    panel?: RiotSkinsPanelLayout,
  ): { endsAt: string; offers: DailyOffer[] } | null {
    const endsAt = this.deadline(panel?.SingleItemOffersRemainingDurationInSeconds);
    if (!endsAt || !panel?.SingleItemStoreOffers?.length) {
      return null;
    }

    const offers: DailyOffer[] = panel.SingleItemStoreOffers.map((offer) => ({
      offerId: offer.OfferID,
      item: this.resolver.resolve(offer.Rewards?.[0]),
      cost: this.parseCost(offer.Cost),
    }));

    return { endsAt, offers };
  }

  private buildNightMarket(
    store?: RiotBonusStore,
  ): { endsAt: string; offers: NightMarketOffer[] } | null {
    const endsAt = this.deadline(store?.BonusStoreRemainingDurationInSeconds);
    if (!endsAt || !store?.BonusStoreOffers?.length) {
      return null;
    }

    const offers: NightMarketOffer[] = store.BonusStoreOffers.map((bOffer) => ({
      offerId: bOffer.BonusOfferID,
      item: this.resolver.resolve(bOffer.Offer?.Rewards?.[0]),
      cost: this.parseCost(bOffer.Offer?.Cost),
      discountedCost: this.parseCost(bOffer.DiscountCosts),
      discountPercent: bOffer.DiscountPercent,
      seen: Boolean(bOffer.IsSeen),
    }));

    return { endsAt, offers };
  }

  private buildBundles(
    featured?: RiotFeaturedBundle,
  ): { endsAt: string | null; items: Bundle[] } | null {
    const rawBundles = featured?.Bundles ?? (featured?.Bundle ? [featured.Bundle] : []);
    if (!rawBundles.length) {
      return null;
    }

    const panelEndsAt = this.deadline(featured?.BundleRemainingDurationInSeconds);
    const bundleItems: Bundle[] = rawBundles.map((b) => {
      const cat = this.catalogue.getBundle(b.DataAssetID);
      const currency = this.catalogue.getCurrency(b.CurrencyID);
      const endsAt = this.deadline(b.DurationRemainingInSeconds);
      const items = (b.Items ?? []).map((bi) => ({
        item: this.resolver.resolve(bi.Item),
        amount: bi.Item?.Amount ?? 1,
        basePrice: bi.BasePrice,
        discountedPrice: bi.DiscountedPrice,
        discountPercent: bi.DiscountPercent,
        promo: Boolean(bi.IsPromoItem),
      }));

      return {
        uuid: b.DataAssetID.toLowerCase(),
        name: cat?.displayName ?? b.DataAssetID,
        subtitle: cat?.displayNameSubText ?? null,
        description: cat?.description ?? null,
        icon: cat?.displayIcon ?? cat?.displayIcon2 ?? null,
        promoImage: cat?.verticalPromoImage ?? cat?.displayIcon ?? null,
        currency: currency?.displayName ?? b.CurrencyID,
        totalBase: b.TotalBaseCost ? this.parseCost(b.TotalBaseCost).amount : null,
        totalDiscounted: b.TotalDiscountedCost
          ? this.parseCost(b.TotalDiscountedCost).amount
          : null,
        discountPercent: b.TotalDiscountPercent ?? 0,
        wholesaleOnly: Boolean(b.WholesaleOnly),
        endsAt,
        items,
      };
    });

    const candidates = [
      ...(panelEndsAt ? [panelEndsAt] : []),
      ...bundleItems.map((b) => b.endsAt).filter((e): e is string => e !== null),
    ];

    if (candidates.length === 0) {
      return null;
    }

    const endsAt = candidates.sort()[0]!;
    return { endsAt, items: bundleItems };
  }

  private buildAccessories(
    acc?: RiotAccessoryStore,
  ): { endsAt: string; offers: AccessoryOffer[] } | null {
    const endsAt = this.deadline(acc?.AccessoryStoreRemainingDurationInSeconds);
    if (!endsAt || !acc?.AccessoryStoreOffers?.length) {
      return null;
    }

    const offers: AccessoryOffer[] = acc.AccessoryStoreOffers.map((offer) => ({
      offerId: offer.Offer?.OfferID ?? "",
      item: this.resolver.resolve(offer.Offer?.Rewards?.[0]),
      cost: this.parseCost(offer.Offer?.Cost),
      contractUuid: offer.ContractID.toLowerCase(),
    }));

    return { endsAt, offers };
  }

  private buildRadianite(up?: RiotUpgradeCurrencyStore): RadianiteOffer[] {
    if (!up?.UpgradeCurrencyOffers?.length) {
      return [];
    }

    return up.UpgradeCurrencyOffers.map((offer) => ({
      offerId: offer.OfferID,
      amount: offer.Offer?.Rewards?.[0]?.Quantity ?? 0,
      cost: this.parseCost(offer.Offer?.Cost),
      discountPercent: offer.DiscountedPercent,
    }));
  }
}
