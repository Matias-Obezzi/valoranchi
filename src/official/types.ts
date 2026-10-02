export interface OfficialAccountResponse {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface OfficialActiveShardResponse {
  puuid: string;
  game: string;
  activeShard: string;
}

export interface OfficialMatchlistEntry {
  matchId: string;
  gameStartTimeMillis: number;
  queueId: string;
}

export interface OfficialMatchlistResponse {
  puuid: string;
  history: OfficialMatchlistEntry[];
}

export interface OfficialPlayerAbilityCasts {
  grenadeCasts?: number;
  ability1Casts?: number;
  ability2Casts?: number;
  ultimateCasts?: number;
}

export interface OfficialPlayerStats {
  score: number;
  roundsPlayed: number;
  kills: number;
  deaths: number;
  assists: number;
  playtimeMillis?: number;
  abilityCasts?: OfficialPlayerAbilityCasts;
}

export interface OfficialMatchPlayer {
  puuid?: string;
  subject?: string;
  gameName: string;
  tagLine: string;
  teamId: string;
  partyId?: string;
  characterId: string;
  stats?: OfficialPlayerStats | null;
  competitiveTier?: number;
  playerCard?: string;
  playerTitle?: string;
  accountLevel?: number;
}

export interface OfficialMatchTeam {
  teamId: string;
  won: boolean;
  roundsPlayed: number;
  roundsWon: number;
  numPoints?: number;
}

export interface OfficialMatchCoach {
  puuid: string;
  teamId: string;
}

export interface OfficialFinishingDamage {
  damageType?: string;
  damageItem?: string;
  isSecondaryFireMode?: boolean;
}

export interface OfficialKill {
  gameTime?: number;
  roundTime?: number;
  killer?: string;
  victim?: string;
  victimLocation?: { x: number; y: number } | null;
  assistants?: string[];
  finishingDamage?: OfficialFinishingDamage;
}

export interface OfficialDamage {
  receiver?: string;
  puuid?: string;
  damage?: number;
  legshots?: number;
  bodyshots?: number;
  headshots?: number;
}

export interface OfficialRoundPlayerStats {
  puuid?: string;
  subject?: string;
  kills?: OfficialKill[];
  damage?: OfficialDamage[];
  score?: number;
}

export interface OfficialRoundResult {
  roundNum: number;
  roundResult: string;
  roundCeremony?: string | null;
  winningTeam: string;
  bombPlanter?: string | null;
  planter?: string | null;
  bombDefuser?: string | null;
  defuser?: string | null;
  plantRoundTime?: number | null;
  plantSite?: string | null;
  defuseRoundTime?: number | null;
  playerStats?: OfficialRoundPlayerStats[];
}

export interface OfficialMatchInfo {
  matchId: string;
  mapId: string;
  gameLengthMillis: number;
  gameStartMillis: number;
  provisioningFlowId?: string;
  provisioningFlowID?: string;
  isCompleted: boolean;
  customGameName?: string | null;
  queueId?: string;
  queueID?: string;
  gameMode?: string;
  isRanked: boolean;
  seasonId?: string;
  completionState?: string;
  platformId?: string;
  gameServerAddress?: string;
  gameVersion?: string;
  isReplayRecorded?: boolean;
}

export interface OfficialMatchResponse {
  matchInfo: OfficialMatchInfo;
  players: OfficialMatchPlayer[];
  coaches?: OfficialMatchCoach[];
  teams: OfficialMatchTeam[] | null;
  roundResults?: OfficialRoundResult[] | null;
}

export interface OfficialRecentMatchesResponse {
  currentTime: number;
  matchIds: string[];
}

export interface OfficialLeaderboardPlayer {
  puuid: string;
  gameName: string;
  tagLine: string;
  leaderboardRank: number;
  rankedRating: number;
  numberOfWins: number;
  competitiveTier: number;
}

export interface OfficialLeaderboardResponse {
  shard: string;
  actId: string;
  totalPlayers: number;
  players: OfficialLeaderboardPlayer[];
}

export interface OfficialAct {
  id: string;
  name: string;
  isActive: boolean;
  type?: string;
}

export interface OfficialContentItem {
  name: string;
  id?: string;
  assetName?: string;
  assetPath?: string;
}

export interface OfficialContentResponse {
  version: string;
  characters?: OfficialContentItem[];
  maps?: OfficialContentItem[];
  chromas?: OfficialContentItem[];
  skins?: OfficialContentItem[];
  skinLevels?: OfficialContentItem[];
  equips?: OfficialContentItem[];
  gameModes?: OfficialContentItem[];
  sprays?: OfficialContentItem[];
  sprayLevels?: OfficialContentItem[];
  charms?: OfficialContentItem[];
  charmLevels?: OfficialContentItem[];
  playerCards?: OfficialContentItem[];
  playerTitles?: OfficialContentItem[];
  acts: OfficialAct[];
}

export interface OfficialStatusUpdate {
  id: number;
  author: string;
  publish: boolean;
  publish_locations: string[];
  translations: Array<{ locale: string; content: string }>;
  created_at: string;
  updated_at: string;
}

export interface OfficialStatusIncident {
  id: number;
  maintenance_status?: string;
  incident_severity?: string;
  titles: Array<{ locale: string; content: string }>;
  updates: OfficialStatusUpdate[];
  created_at: string;
  archive_at?: string | null;
  updated_at?: string | null;
  platforms: string[];
}

export interface OfficialPlatformData {
  id: string;
  name: string;
  locales: string[];
  maintenances: OfficialStatusIncident[];
  incidents: OfficialStatusIncident[];
}
