export { defaultResponseCacheDir } from "./riot/ResponseCache.js";
export { defaultCatalogueDir } from "./catalogue/CatalogueStore.js";
export {
  RiotClient,
  type RiotClientOptions,
  type LoadoutChange,
  type LoadoutGunChange,
  type PartyActionRequest,
} from "./RiotClient.js";
export type {
  AccountApi,
  LocalRawApi,
  MatchesApi,
  PartyApi,
  RiotRawApi,
  SocialApi,
  StoreApi,
} from "./client/api.js";
export { PartyValidator, type PartyAction } from "./client/PartyValidator.js";
export { RiotEvents, toFriendRequest, type RiotEventMap } from "./events/RiotEvents.js";
export { TypedEmitter } from "./events/TypedEmitter.js";
export {
  RiotSocket,
  parseFrame,
  type RiotFrame,
  type RiotEventType,
  type RiotSocketOptions,
  type RiotSocketCredentials,
} from "./local/RiotSocket.js";

export {
  ForbiddenHostError,
  RegionUnknownError,
  RiotApiError,
  RiotClientError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
  ValidationError,
} from "./errors.js";

export type {
  AccessoryOffer,
  Agent,
  BlockedPlayer,
  Bundle,
  BundleItem,
  Conversation,
  Cost,
  DailyOffer,
  Friend,
  FriendRequest,
  Image,
  LiveMatch,
  LiveMatchPlayer,
  Loadout,
  LoadoutGun,
  Match,
  MatchPlayer,
  MatchRound,
  MatchSummary,
  Message,
  Mmr,
  NightMarketOffer,
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
  Party,
  PartyMember,
  Player,
  PresenceState,
  RadianiteOffer,
  Rank,
  RankChange,
  Store,
  StoreItem,
  Tier,
  ValorantPresence,
  Wallet,
} from "./model/index.js";
