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

export interface RiotActiveExpression {
  TypeID: string;
  AssetID: string;
}

export interface RiotLoadoutResponse {
  Subject?: string;
  Version?: number;
  Guns: RiotLoadoutGun[];
  ActiveExpressions?: RiotActiveExpression[];
  Sprays?: RiotLoadoutSpray[];
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

export interface RiotMatchHistoryItem {
  MatchID: string;
  GameStartTime: number;
  QueueID: string;
}

export interface RiotMatchHistoryResponse {
  Subject: string;
  BeginIndex: number;
  EndIndex: number;
  Total: number;
  History: RiotMatchHistoryItem[];
}

export interface RiotMatchInfo {
  matchId: string;
  mapId: string;
  gamePodId?: string;
  gameLoopZone?: string;
  gameServerAddress?: string;
  gameVersion?: string;
  gameLengthMillis: number;
  gameStartMillis: number;
  provisioningFlowID?: string;
  isCompleted: boolean;
  customGameName?: string | null;
  queueID: string;
  gameMode?: string;
  isRanked: boolean;
  seasonId?: string;
  completionState?: string;
  isReplayRecorded?: boolean;
}

export interface RiotPlayerAbilityCasts {
  grenadeCasts?: number;
  ability1Casts?: number;
  ability2Casts?: number;
  ultimateCasts?: number;
}

export interface RiotPlayerStats {
  score: number;
  roundsPlayed: number;
  kills: number;
  deaths: number;
  assists: number;
  playtimeMillis?: number;
  abilityCasts?: RiotPlayerAbilityCasts;
}

export interface RiotMatchPlayer {
  subject: string;
  gameName: string;
  tagLine: string;
  teamId: string;
  partyId?: string;
  characterId: string;
  stats?: RiotPlayerStats | null;
  competitiveTier?: number;
  playerCard?: string;
  playerTitle?: string;
  accountLevel?: number;
}

export interface RiotMatchTeam {
  teamId: string;
  won: boolean;
  roundsPlayed: number;
  roundsWon: number;
  numPoints?: number;
}

export interface RiotFinishingDamage {
  damageType: string;
  damageItem: string;
  isSecondaryFireMode?: boolean;
}

export interface RiotKill {
  gameTime?: number;
  roundTime: number;
  killer: string;
  victim: string;
  victimLocation?: { x: number; y: number } | null;
  assistants?: string[];
  finishingDamage?: RiotFinishingDamage;
}

export interface RiotDamage {
  receiver: string;
  damage: number;
  legshots: number;
  bodyshots: number;
  headshots: number;
}

export interface RiotRoundPlayerStats {
  subject: string;
  kills?: RiotKill[];
  damage?: RiotDamage[];
  score?: number;
}

export interface RiotRoundResult {
  roundNum: number;
  roundResult: string;
  roundCeremony?: string | null;
  winningTeam: string;
  bombPlanter?: string | null;
  bombDefuser?: string | null;
  plantRoundTime?: number | null;
  plantSite?: string | null;
  defuseRoundTime?: number | null;
  playerStats?: RiotRoundPlayerStats[];
}

export interface RiotMatchDetailsResponse {
  matchInfo: RiotMatchInfo;
  players: RiotMatchPlayer[];
  teams: RiotMatchTeam[] | null;
  roundResults?: RiotRoundResult[] | null;
}

export interface RiotSeasonalInfo {
  SeasonID?: string;
  NumberOfWins?: number;
  NumberOfWinsWithPlacements?: number;
  NumberOfGames?: number;
  Rank?: number;
  CapstoneWins?: number;
  LeaderboardRank?: number;
  CompetitiveTier?: number;
  RankedRating?: number;
  WinsByTier?: Record<string, number> | null;
  GamesNeededForRating?: number;
  TotalWinsNeededForRank?: number;
}

export interface RiotCompetitiveUpdate {
  MatchID: string;
  MapID: string;
  SeasonID: string;
  MatchStartTime: number;
  TierAfterUpdate: number;
  TierBeforeUpdate: number;
  RankedRatingAfterUpdate: number;
  RankedRatingBeforeUpdate: number;
  RankedRatingEarned: number;
  RankedRatingPerformanceBonus: number;
  CompetitiveMovement: string;
  AFKPenalty: number;
}

export interface RiotQueueSkills {
  TotalGamesNeededForRating?: number;
  TotalGamesNeededForLeaderboard?: number;
  CurrentSeasonGamesNeededForRating?: number;
  SeasonalInfoBySeasonID?: Record<string, RiotSeasonalInfo>;
}

export interface RiotMmrResponse {
  Subject?: string;
  Version?: number;
  QueueSkills?: {
    competitive?: RiotQueueSkills;
    [queue: string]: unknown;
  };
  LatestCompetitiveUpdate?: RiotCompetitiveUpdate | null;
  IsLeaderboardAnonymized?: boolean;
  IsActRankBadgeHidden?: boolean;
}

export interface RiotCompetitiveUpdatesResponse {
  Matches: RiotCompetitiveUpdate[];
}

export interface RiotPregamePlayerResponse {
  Subject: string;
  MatchID: string;
  Version: number;
}

export interface RiotPregamePlayer {
  Subject: string;
  CharacterID: string;
  CharacterSelectionState: string;
  PregamePlayerState?: string;
  CompetitiveTier?: number;
  PlayerIdentity?: {
    Subject?: string;
    PlayerCardID?: string;
    PlayerTitleID?: string;
    AccountLevel?: number;
    Incognito?: boolean;
    HideAccountLevel?: boolean;
  };
}

export interface RiotPregameMatchResponse {
  ID: string;
  AllyTeam?: {
    TeamID: string;
    Players: RiotPregamePlayer[];
  };
  EnemyTeam?: {
    TeamID: string;
    Players: RiotPregamePlayer[];
  } | null;
  EnemyTeamSize?: number;
  EnemyTeamLockCount?: number;
  MapID?: string;
  QueueID?: string;
  Mode?: string;
  IsRanked?: boolean;
  PhaseTimeRemainingNS?: number;
  ProvisioningFlowID?: string;
}

export interface RiotCoreGamePlayerResponse {
  Subject: string;
  MatchID: string;
  Version: number;
}

export interface RiotCoreGamePlayer {
  Subject: string;
  TeamID?: string;
  CharacterID: string;
  PlayerIdentity?: {
    PlayerCardID?: string;
    PlayerTitleID?: string;
    AccountLevel?: number;
    Incognito?: boolean;
    HideAccountLevel?: boolean;
  };
}

export interface RiotCoreGameMatchResponse {
  MatchID: string;
  State?: string;
  MapID?: string;
  ModeID?: string;
  ProvisioningFlow?: string;
  Players: RiotCoreGamePlayer[];
  MatchmakingData?: {
    QueueID?: string;
    IsRanked?: boolean;
  } | null;
}

export interface RiotCoreGameSocketItem {
  ID: string;
  Item?: {
    ID: string;
    TypeID?: string;
  };
}

export interface RiotCoreGameLoadoutItem {
  ID: string;
  TypeID?: string;
  Sockets?: Record<string, RiotCoreGameSocketItem>;
}

export interface RiotCoreGameLoadoutEntry {
  CharacterID?: string;
  Loadout: {
    Subject: string;
    Items: Record<string, RiotCoreGameLoadoutItem>;
  };
}

export interface RiotCoreGameLoadoutsResponse {
  Loadouts: RiotCoreGameLoadoutEntry[];
}

export interface RiotPartyPlayerResponse {
  Subject: string;
  CurrentPartyID: string;
}

export interface RiotPartyMember {
  Subject: string;
  CompetitiveTier?: number;
  PlayerIdentity?: {
    PlayerCardID?: string;
    PlayerTitleID?: string;
    AccountLevel?: number;
    Incognito?: boolean;
  };
  IsOwner?: boolean;
  IsReady?: boolean;
  IsModerator?: boolean;
}

export interface RiotPartyResponse {
  ID: string;
  State: string;
  Accessibility: "OPEN" | "CLOSED" | string;
  MatchmakingData?: {
    QueueID?: string;
  } | null;
  EligibleQueues?: string[];
  QueueIneligibilities?: unknown[];
  InviteCode?: string | null;
  Invites?: unknown[] | null;
  Requests?: unknown[] | null;
  RestrictedSeconds?: number;
  QueueEntryTime?: string | null;
  Members: RiotPartyMember[];
}
