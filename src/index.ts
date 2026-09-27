export { defaultResponseCacheDir } from "./riot/ResponseCache.js";
export { defaultCatalogueDir } from "./catalogue/CatalogueStore.js";
export { RiotClient, type RiotClientOptions } from "./RiotClient.js";

export {
  ForbiddenHostError,
  RegionUnknownError,
  RiotApiError,
  RiotClientError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
} from "./errors.js";

export type {
  Image,
  Loadout,
  LoadoutGun,
  OwnedAgent,
  OwnedBuddy,
  OwnedCard,
  OwnedChroma,
  OwnedItems,
  OwnedSkin,
  OwnedSkinLevel,
  OwnedSpray,
  OwnedTitle,
  OwnedWeapon,
  Player,
  Tier,
  Wallet,
} from "./model/index.js";
