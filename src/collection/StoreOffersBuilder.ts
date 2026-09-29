import type { Catalogue } from "../catalogue/Catalogue.js";
import type { Cost, Offer, Order, StoreItem } from "../model/index.js";
import type { RiotOffersResponse, RiotOrderResponse } from "../riot/types.js";
import { StoreItemResolver } from "./StoreItemResolver.js";

export class StoreOffersBuilder {
  private readonly resolver: StoreItemResolver;

  constructor(private readonly catalogue: Catalogue) {
    this.resolver = new StoreItemResolver(catalogue);
  }

  buildOffers(raw: RiotOffersResponse): Offer[] {
    return (raw.Offers ?? []).map((o) => {
      const reward = o.Rewards?.[0];
      const item = this.resolver.resolve(reward);
      return {
        id: o.OfferID,
        item,
        cost: this.resolveCost(o.Cost),
        startedAt: o.StartDate ?? null,
      };
    });
  }

  buildOrder(raw: RiotOrderResponse): Order {
    const id = raw.ID ?? raw.id ?? "";
    const status = raw.Status ?? raw.status ?? "completed";
    let item: StoreItem | null = null;
    if (raw.ItemID && raw.ItemTypeID) {
      item = this.resolver.resolve({ ItemID: raw.ItemID, ItemTypeID: raw.ItemTypeID });
    }
    const cost = this.resolveCost(raw.Cost ?? raw.TotalCost);
    return { id, status, item, cost: cost.amount > 0 ? cost : null };
  }

  private resolveCost(costMap?: Record<string, number> | null): Cost {
    if (!costMap) return { currency: "", currencyUuid: "", amount: 0 };
    const entries = Object.entries(costMap);
    if (entries.length === 0) return { currency: "", currencyUuid: "", amount: 0 };
    const [currencyUuid, amount] = entries[0]!;
    const currency = this.catalogue.getCurrency(currencyUuid);
    return {
      currency: currency?.displayName ?? currencyUuid,
      currencyUuid: currencyUuid.toLowerCase(),
      amount,
    };
  }
}
