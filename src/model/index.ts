export type Player = {
  puuid: string;
  gameName: string;
  tagLine: string;
  region: string;
  shard: string;
  accountLevel: number;
};

export type Image = string | null;

export type Tier = {
  uuid: string;
  name: string;
  rank: number;
  icon: Image;
};

export type OwnedSkinLevel = {
  uuid: string;
  name: string;
  owned: boolean;
};

export type OwnedChroma = {
  uuid: string;
  name: string;
  owned: boolean;
  swatch: Image;
};

export type OwnedSkin = {
  uuid: string;
  name: string;
  tier: Tier | null;
  icon: Image;
  levels: OwnedSkinLevel[];
  chromas: OwnedChroma[];
};

export type OwnedWeapon = {
  uuid: string;
  name: string;
  category: string;
  skinsOwned: number;
  skinsTotal: number;
  skins: OwnedSkin[];
};

export type OwnedCard = {
  uuid: string;
  name: string;
  small: Image;
  wide: Image;
  large: Image;
};

export type OwnedTitle = {
  uuid: string;
  name: string;
  text: string | null;
};

export type OwnedSpray = {
  uuid: string;
  name: string;
  icon: Image;
};

export type OwnedBuddy = {
  uuid: string;
  name: string;
  icon: Image;
  instances: number;
};

export type OwnedAgent = {
  uuid: string;
  name: string;
  role: string | null;
  icon: Image;
};

export type OwnedItems = {
  player: Player;
  language: string;
  generatedAt: string;
  weapons: OwnedWeapon[];
  cards: OwnedCard[];
  titles: OwnedTitle[];
  sprays: OwnedSpray[];
  buddies: OwnedBuddy[];
  agents: OwnedAgent[];
};

export type LoadoutGun = {
  weapon: { uuid: string; name: string };
  skin: { uuid: string; name: string; icon: Image };
  level: { uuid: string; name: string };
  chroma: { uuid: string; name: string };
  buddy: { uuid: string; name: string; icon: Image } | null;
};

export type Loadout = {
  player: Player;
  guns: LoadoutGun[];
  sprays: Array<{ slot: string; uuid: string; name: string; icon: Image }>;
  card: OwnedCard | null;
  title: OwnedTitle | null;
  incognito: boolean;
};

export type Wallet = {
  valorantPoints: number;
  radianite: number;
  kingdomCredits: number;
};
