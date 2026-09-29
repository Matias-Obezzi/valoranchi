import { ValidationError } from "../errors.js";
import type { Cost, OwnedItems, Store, StoreItem, Wallet } from "../model/index.js";
import { CURRENCY_UUIDS, ENTITLEMENT_ITEM_TYPES } from "../riot/types.js";

export type BuyTarget = { offerId: string } | { bundleId: string };

export type BuyValidationResult =
  | {
      type: "offer";
      payload: { ItemTypeID: string; ItemID: string; Quantity: number };
      cost: Cost;
    }
  | {
      type: "bundle";
      bundleId: string;
      payload: { BundleID: string; Quantity: number };
      cost: Cost;
    };

export class StoreValidator {
  static validateNightMarket(store: Store): void {
    if (!store.nightMarket) {
      throw new ValidationError("night-market-missing", "Night market is not active");
    }
    const hasUnseen = store.nightMarket.offers.some((o) => !o.seen);
    if (!hasUnseen) {
      throw new ValidationError(
        "night-market-revealed",
        "Night market offers are already revealed",
      );
    }
  }

  static validateBuy(
    store: Store,
    ownedItems: OwnedItems,
    wallet: Wallet,
    target: BuyTarget,
    confirm?: boolean,
  ): BuyValidationResult {
    if (!confirm) {
      throw new ValidationError(
        "confirm-required",
        "Purchase confirmation required: pass confirm: true (or --confirm in CLI)",
      );
    }
    return "offerId" in target
      ? this.validateBuyOffer(store, ownedItems, wallet, target.offerId)
      : this.validateBuyBundle(store, ownedItems, wallet, target.bundleId);
  }

  private static validateBuyOffer(
    store: Store,
    owned: OwnedItems,
    wallet: Wallet,
    offerId: string,
  ): BuyValidationResult {
    const all = [
      ...(store.daily?.offers ?? []),
      ...(store.accessories?.offers ?? []),
      ...(store.nightMarket?.offers ?? []),
    ];
    const match = all.find((o) => o.offerId.toLowerCase() === offerId.toLowerCase());
    if (!match) {
      throw new ValidationError("offer-not-in-store", `Offer not in store: ${offerId}`);
    }

    if (this.isItemOwned(match.item, owned)) {
      throw new ValidationError("already-owned", `Item is already owned: ${match.item.name}`);
    }

    const cost: Cost =
      "discountedCost" in match ? (match as { discountedCost: Cost }).discountedCost : match.cost;
    this.checkFunds(cost, wallet);

    const itemTypeId =
      match.item.kind === "skin"
        ? ENTITLEMENT_ITEM_TYPES.skinLevel
        : match.item.kind === "buddy"
          ? ENTITLEMENT_ITEM_TYPES.buddy
          : match.item.kind === "spray"
            ? ENTITLEMENT_ITEM_TYPES.spray
            : match.item.kind === "card"
              ? ENTITLEMENT_ITEM_TYPES.playerCard
              : match.item.kind === "title"
                ? ENTITLEMENT_ITEM_TYPES.playerTitle
                : "";

    return {
      type: "offer",
      payload: { ItemTypeID: itemTypeId, ItemID: match.item.uuid, Quantity: 1 },
      cost,
    };
  }

  private static validateBuyBundle(
    store: Store,
    owned: OwnedItems,
    wallet: Wallet,
    bundleId: string,
  ): BuyValidationResult {
    const bundle = store.bundles?.items.find(
      (b) => b.uuid.toLowerCase() === bundleId.toLowerCase(),
    );
    if (!bundle) {
      throw new ValidationError("offer-not-in-store", `Bundle not in store: ${bundleId}`);
    }

    const allOwned =
      bundle.items.length > 0 && bundle.items.every((bi) => this.isItemOwned(bi.item, owned));
    if (allOwned) {
      throw new ValidationError(
        "already-owned",
        `All items in bundle are already owned: ${bundle.name}`,
      );
    }

    const costAmount = bundle.totalDiscounted ?? bundle.totalBase ?? 0;
    const cost: Cost = {
      currency: bundle.currency,
      currencyUuid: CURRENCY_UUIDS.valorantPoints,
      amount: costAmount,
    };
    this.checkFunds(cost, wallet);

    return {
      type: "bundle",
      bundleId: bundle.uuid,
      payload: { BundleID: bundle.uuid, Quantity: 1 },
      cost,
    };
  }

  static isItemOwned(item: StoreItem, owned: OwnedItems): boolean {
    const id = item.uuid.toLowerCase();
    if (item.kind === "skin") {
      return owned.weapons.flatMap((w) => w.skins).some((s) => s.uuid.toLowerCase() === id);
    }
    if (item.kind === "buddy") {
      return owned.buddies.some((b) => b.uuid.toLowerCase() === id);
    }
    if (item.kind === "spray") {
      return owned.sprays.some((s) => s.uuid.toLowerCase() === id);
    }
    if (item.kind === "card") {
      return owned.cards.some((c) => c.uuid.toLowerCase() === id);
    }
    if (item.kind === "title") {
      return owned.titles.some((t) => t.uuid.toLowerCase() === id);
    }
    if (item.kind === "agent") {
      return owned.agents.some((a) => a.uuid.toLowerCase() === id);
    }
    return false;
  }

  static checkFunds(cost: Cost, wallet: Wallet): void {
    const cur = cost.currencyUuid.toLowerCase();
    if (
      cur === CURRENCY_UUIDS.valorantPoints.toLowerCase() &&
      wallet.valorantPoints < cost.amount
    ) {
      throw new ValidationError("insufficient-funds", "Insufficient Valorant Points");
    }
    if (cur === CURRENCY_UUIDS.radianite.toLowerCase() && wallet.radianite < cost.amount) {
      throw new ValidationError("insufficient-funds", "Insufficient Radianite");
    }
    if (
      cur === CURRENCY_UUIDS.kingdomCredits.toLowerCase() &&
      wallet.kingdomCredits < cost.amount
    ) {
      throw new ValidationError("insufficient-funds", "Insufficient Kingdom Credits");
    }
  }
}
