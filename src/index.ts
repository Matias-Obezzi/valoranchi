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
  FriendsWatcher,
  MatchWatcher,
  formatPresenceActivity,
  type FriendsWatcherOptions,
  type MatchWatcherOptions,
  type WatchApi,
  type MatchWatchEventMap,
  type MatchWatchItem,
  type FriendsWatchEventMap,
  type FriendsWatchItem,
} from "./watch/index.js";
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
  RatingTrend,
  PerformanceSummary,
  PlayerAssessment,
  LoadoutDiff,
  LoadoutDiffItem,
  CollectionValue,
  CollectionValueGroup,
  CollectionValueItem,
  StoreHistory,
  StoreHistoryDay,
  StoreSeen,
  MatchSyncResult,
  Store,
  StoreItem,
  Tier,
  ValorantPresence,
  Wallet,
} from "./model/index.js";
export { ratingTrend } from "./analysis/ratingTrend.js";
export { performanceSummary } from "./analysis/performanceSummary.js";
export { playerAssessment } from "./analysis/playerAssessment.js";
export { diffLoadout, exportLoadout } from "./analysis/loadoutDiff.js";
export { collectionValue } from "./analysis/collectionValue.js";
export {
  recordStoreRotation,
  querySkinSeen,
  loadStoreHistory,
  saveStoreHistory,
} from "./analysis/storeHistory.js";
export {
  loadKnownMatches,
  saveKnownMatches,
  syncMatches,
} from "./analysis/matchSync.js";

