import type {
  ValorantApiAgent,
  ValorantApiBuddy,
  ValorantApiBuddyLevel,
  ValorantApiBundle,
  ValorantApiCatalogueData,
  ValorantApiChroma,
  ValorantApiContentTier,
  ValorantApiCurrency,
  ValorantApiPlayerCard,
  ValorantApiPlayerTitle,
  ValorantApiSkin,
  ValorantApiSkinLevel,
  ValorantApiSpray,
  ValorantApiWeapon,
} from "./types.js";

export class Catalogue {
  readonly weapons: readonly ValorantApiWeapon[];
  private readonly weaponsByUuid = new Map<string, ValorantApiWeapon>();
  private readonly skinsByUuid = new Map<string, ValorantApiSkin>();
  private readonly skinLevelIndex = new Map<
    string,
    { weapon: ValorantApiWeapon; skin: ValorantApiSkin; level: ValorantApiSkinLevel }
  >();
  private readonly chromaIndex = new Map<
    string,
    { weapon: ValorantApiWeapon; skin: ValorantApiSkin; chroma: ValorantApiChroma }
  >();
  private readonly buddyLevelIndex = new Map<
    string,
    { buddy: ValorantApiBuddy; level: ValorantApiBuddyLevel }
  >();
  private readonly buddiesByUuid = new Map<string, ValorantApiBuddy>();
  private readonly cardsByUuid = new Map<string, ValorantApiPlayerCard>();
  private readonly titlesByUuid = new Map<string, ValorantApiPlayerTitle>();
  private readonly spraysByUuid = new Map<string, ValorantApiSpray>();
  private readonly agentsByUuid = new Map<string, ValorantApiAgent>();
  private readonly tiersByUuid = new Map<string, ValorantApiContentTier>();
  private readonly currenciesByUuid = new Map<string, ValorantApiCurrency>();
  private readonly bundlesByUuid = new Map<string, ValorantApiBundle>();

  constructor(data: ValorantApiCatalogueData) {
    this.weapons = data.weapons;
    this.indexWeapons(data.weapons);
    this.indexBuddies(data.buddies);
    this.indexOtherEntities(data);
  }

  private indexWeapons(weapons: ValorantApiWeapon[]): void {
    for (const weapon of weapons) {
      this.weaponsByUuid.set(weapon.uuid.toLowerCase(), weapon);
      for (const skin of weapon.skins) {
        this.skinsByUuid.set(skin.uuid.toLowerCase(), skin);
        for (const level of skin.levels) {
          this.skinLevelIndex.set(level.uuid.toLowerCase(), { weapon, skin, level });
        }
        for (const chroma of skin.chromas) {
          this.chromaIndex.set(chroma.uuid.toLowerCase(), { weapon, skin, chroma });
        }
      }
    }
  }

  private indexBuddies(buddies: ValorantApiBuddy[]): void {
    for (const buddy of buddies) {
      this.buddiesByUuid.set(buddy.uuid.toLowerCase(), buddy);
      for (const level of buddy.levels) {
        this.buddyLevelIndex.set(level.uuid.toLowerCase(), { buddy, level });
      }
    }
  }

  private indexOtherEntities(data: ValorantApiCatalogueData): void {
    for (const card of data.playerCards) {
      this.cardsByUuid.set(card.uuid.toLowerCase(), card);
    }
    for (const title of data.playerTitles) {
      this.titlesByUuid.set(title.uuid.toLowerCase(), title);
    }
    for (const spray of data.sprays) {
      this.spraysByUuid.set(spray.uuid.toLowerCase(), spray);
    }
    for (const agent of data.agents) {
      this.agentsByUuid.set(agent.uuid.toLowerCase(), agent);
    }
    for (const tier of data.contentTiers) {
      this.tiersByUuid.set(tier.uuid.toLowerCase(), tier);
    }
    for (const currency of data.currencies) {
      this.currenciesByUuid.set(currency.uuid.toLowerCase(), currency);
    }
    for (const bundle of data.bundles ?? []) {
      this.bundlesByUuid.set(bundle.uuid.toLowerCase(), bundle);
    }
  }

  findSkinAndWeaponByLevel(levelUuid: string) {
    return this.skinLevelIndex.get(levelUuid.toLowerCase());
  }

  findSkinAndWeaponByChroma(chromaUuid: string) {
    return this.chromaIndex.get(chromaUuid.toLowerCase());
  }

  findBuddyByLevel(buddyLevelUuid: string) {
    return this.buddyLevelIndex.get(buddyLevelUuid.toLowerCase());
  }

  getWeapon(uuid: string): ValorantApiWeapon | undefined {
    return this.weaponsByUuid.get(uuid.toLowerCase());
  }

  getSkin(uuid: string): ValorantApiSkin | undefined {
    return this.skinsByUuid.get(uuid.toLowerCase());
  }

  getBuddy(uuid: string): ValorantApiBuddy | undefined {
    return this.buddiesByUuid.get(uuid.toLowerCase());
  }

  getCard(uuid: string): ValorantApiPlayerCard | undefined {
    return this.cardsByUuid.get(uuid.toLowerCase());
  }

  getTitle(uuid: string): ValorantApiPlayerTitle | undefined {
    return this.titlesByUuid.get(uuid.toLowerCase());
  }

  getSpray(uuid: string): ValorantApiSpray | undefined {
    return this.spraysByUuid.get(uuid.toLowerCase());
  }

  getAgent(uuid: string): ValorantApiAgent | undefined {
    return this.agentsByUuid.get(uuid.toLowerCase());
  }

  getTier(uuid: string): ValorantApiContentTier | undefined {
    return this.tiersByUuid.get(uuid.toLowerCase());
  }

  getCurrency(uuid: string): ValorantApiCurrency | undefined {
    return this.currenciesByUuid.get(uuid.toLowerCase());
  }

  getBundle(uuid: string): ValorantApiBundle | undefined {
    return this.bundlesByUuid.get(uuid.toLowerCase());
  }
}
