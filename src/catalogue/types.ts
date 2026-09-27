export interface ValorantApiSkinLevel {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
}

export interface ValorantApiChroma {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
  swatch: string | null;
}

export interface ValorantApiSkin {
  uuid: string;
  displayName: string;
  contentTierUuid: string | null;
  displayIcon: string | null;
  levels: ValorantApiSkinLevel[];
  chromas: ValorantApiChroma[];
}

export interface ValorantApiWeapon {
  uuid: string;
  displayName: string;
  category: string;
  shopData?: {
    categoryText?: string;
  } | null;
  skins: ValorantApiSkin[];
}

export interface ValorantApiPlayerCard {
  uuid: string;
  displayName: string;
  smallArt: string | null;
  wideArt: string | null;
  largeArt: string | null;
}

export interface ValorantApiPlayerTitle {
  uuid: string;
  displayName: string;
  titleText: string | null;
}

export interface ValorantApiSpray {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
  fullTransparentIcon: string | null;
}

export interface ValorantApiBuddyLevel {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
}

export interface ValorantApiBuddy {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
  levels: ValorantApiBuddyLevel[];
}

export interface ValorantApiAgent {
  uuid: string;
  displayName: string;
  role: {
    displayName?: string;
  } | null;
  displayIcon: string | null;
  isPlayableCharacter: boolean;
}

export interface ValorantApiContentTier {
  uuid: string;
  displayName: string;
  rank: number;
  displayIcon: string | null;
}

export interface ValorantApiCurrency {
  uuid: string;
  displayName: string;
}

export interface ValorantApiCatalogueData {
  weapons: ValorantApiWeapon[];
  playerCards: ValorantApiPlayerCard[];
  playerTitles: ValorantApiPlayerTitle[];
  sprays: ValorantApiSpray[];
  buddies: ValorantApiBuddy[];
  agents: ValorantApiAgent[];
  contentTiers: ValorantApiContentTier[];
  currencies: ValorantApiCurrency[];
}
