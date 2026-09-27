export const ENTITLEMENT_ITEM_TYPES = {
  skinLevel: "e7c63390-eda7-46e0-bb7a-a6abdacd2433",
  skinChroma: "3ad1b2b2-acdb-4524-852f-954a76ddae0a",
  agent: "01bb38e1-da47-4e6a-9b3d-945fe4655707",
  contract: "f85cb6f7-33e5-4dc8-b609-ec7212301948",
  buddy: "dd3bf334-87f3-40bd-b043-682a57a8dc3a",
  spray: "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475",
  flex: "03a572de-4234-31ed-d344-ababa488f981",
  playerCard: "3f296c07-64c3-494c-923b-fe692a4fa1bd",
  playerTitle: "de7caa6b-adf7-4588-bbd1-143831e786c6",
} as const;

export const CURRENCY_UUIDS = {
  valorantPoints: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
  radianite: "e59aa87c-4cbf-517a-5983-6e81511be9b7",
  kingdomCredits: "85ca954a-41f2-ce94-9b45-8ca3dd39a00d",
} as const;

export interface RiotEntitlementItem {
  TypeID: string;
  ItemID: string;
  InstanceID?: string;
}

export interface RiotEntitlementsByType {
  ItemTypeID: string;
  Entitlements: RiotEntitlementItem[];
}

export interface RiotEntitlementsResponse {
  EntitlementsByTypes: RiotEntitlementsByType[];
}

export interface RiotLoadoutGun {
  ID: string;
  SkinID: string;
  SkinLevelID: string;
  ChromaID: string;
  CharmID?: string;
  CharmLevelID?: string;
  CharmInstanceID?: string;
  Attachments?: unknown[];
}

export interface RiotLoadoutSpray {
  EquipSlotID: string;
  SprayID: string;
  SprayLevelID?: string | null;
}

export interface RiotLoadoutIdentity {
  PlayerCardID: string;
  PlayerTitleID: string;
  AccountLevel: number;
  PreferredLevelBorderID?: string;
  HideAccountLevel: boolean;
}

export interface RiotLoadoutResponse {
  Guns: RiotLoadoutGun[];
  Sprays: RiotLoadoutSpray[];
  Identity: RiotLoadoutIdentity;
  Incognito: boolean;
}

export interface RiotAccountXpResponse {
  Progress: { Level: number; XP: number };
}

export interface RiotWalletResponse {
  Balances: Record<string, number>;
}

export interface RiotNameResponse {
  Subject: string;
  GameName: string;
  TagLine: string;
}

export interface RiotStoreReward {
  ItemTypeID: string;
  ItemID: string;
  Quantity: number;
}

export interface RiotStoreOffer {
  OfferID: string;
  IsDirectPurchase?: boolean;
  StartDate?: string;
  Cost: Record<string, number>;
  Rewards: RiotStoreReward[];
}

export interface RiotSkinsPanelLayout {
  SingleItemOffers?: string[];
  SingleItemStoreOffers?: RiotStoreOffer[];
  SingleItemOffersRemainingDurationInSeconds?: number;
}

export interface RiotBonusStoreOffer {
  BonusOfferID: string;
  Offer: RiotStoreOffer;
  DiscountPercent: number;
  DiscountCosts: Record<string, number>;
  IsSeen: boolean;
}

export interface RiotBonusStore {
  BonusStoreOffers?: RiotBonusStoreOffer[];
  BonusStoreRemainingDurationInSeconds?: number;
}

export interface RiotBundleItem {
  Item: {
    ItemTypeID: string;
    ItemID: string;
    Amount: number;
  };
  BasePrice: number;
  CurrencyID: string;
  DiscountPercent: number;
  DiscountedPrice: number;
  IsPromoItem: boolean;
}

export interface RiotBundle {
  ID: string;
  DataAssetID: string;
  CurrencyID: string;
  Items: RiotBundleItem[];
  TotalBaseCost: Record<string, number> | null;
  TotalDiscountedCost: Record<string, number> | null;
  TotalDiscountPercent: number;
  DurationRemainingInSeconds: number;
  WholesaleOnly: boolean;
}

export interface RiotFeaturedBundle {
  Bundle?: RiotBundle;
  Bundles?: RiotBundle[];
  BundleRemainingDurationInSeconds?: number;
}

export interface RiotAccessoryStoreOffer {
  Offer: RiotStoreOffer;
  ContractID: string;
}

export interface RiotAccessoryStore {
  AccessoryStoreOffers?: RiotAccessoryStoreOffer[];
  AccessoryStoreRemainingDurationInSeconds?: number;
  StorefrontID?: string;
}

export interface RiotUpgradeCurrencyOffer {
  OfferID: string;
  StorefrontItemID: string;
  Offer: RiotStoreOffer;
  DiscountedPercent: number;
}

export interface RiotUpgradeCurrencyStore {
  UpgradeCurrencyOffers?: RiotUpgradeCurrencyOffer[];
}

export interface RiotStorefrontResponse {
  FeaturedBundle?: RiotFeaturedBundle;
  SkinsPanelLayout?: RiotSkinsPanelLayout;
  UpgradeCurrencyStore?: RiotUpgradeCurrencyStore;
  AccessoryStore?: RiotAccessoryStore;
  BonusStore?: RiotBonusStore;
}
