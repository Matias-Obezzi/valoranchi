import type { Catalogue } from "../catalogue/Catalogue.js";
import type {
  OwnedAgent,
  OwnedBuddy,
  OwnedCard,
  OwnedItems,
  OwnedSkin,
  OwnedSkinLevel,
  OwnedSpray,
  OwnedTitle,
  OwnedWeapon,
  Player,
} from "../model/index.js";
import { ENTITLEMENT_ITEM_TYPES, type RiotEntitlementsResponse } from "../riot/types.js";

interface EntitlementSets {
  skinLevels: Set<string>;
  skinChromas: Set<string>;
  agents: Set<string>;
  buddyLevels: Map<string, number>;
  cards: Set<string>;
  titles: Set<string>;
  sprays: Set<string>;
}

export class CollectionBuilder {
  private readonly player: Player;
  private readonly catalogue: Catalogue;
  private readonly language: string;
  private readonly sets: EntitlementSets;

  constructor(
    player: Player,
    entitlements: RiotEntitlementsResponse,
    catalogue: Catalogue,
    language = "en-US",
  ) {
    this.player = player;
    this.catalogue = catalogue;
    this.language = language;
    this.sets = this.extractEntitlementSets(entitlements);
  }

  build(now: Date = new Date()): OwnedItems {
    return {
      player: this.player,
      language: this.language,
      generatedAt: now.toISOString(),
      weapons: this.buildWeapons(),
      cards: this.buildCards(),
      titles: this.buildTitles(),
      sprays: this.buildSprays(),
      buddies: this.buildBuddies(),
      agents: this.buildAgents(),
    };
  }

  private buildWeapons(): OwnedWeapon[] {
    return this.catalogue.weapons.map((weapon) => {
      const skins: OwnedSkin[] = [];
      for (const skin of weapon.skins) {
        if (skin.displayName.includes("Standard") || skin.displayName.includes("Random")) {
          continue;
        }

        const levels: OwnedSkinLevel[] = skin.levels.map((lvl) => ({
          uuid: lvl.uuid.toLowerCase(),
          name: lvl.displayName,
          owned: this.sets.skinLevels.has(lvl.uuid.toLowerCase()),
        }));

        if (!levels.some((l) => l.owned)) {
          continue;
        }

        const chromas = skin.chromas.map((ch, idx) => ({
          uuid: ch.uuid.toLowerCase(),
          name: ch.displayName,
          owned: idx === 0 || this.sets.skinChromas.has(ch.uuid.toLowerCase()),
          swatch: ch.swatch,
        }));

        const tierEntity = skin.contentTierUuid
          ? this.catalogue.getTier(skin.contentTierUuid)
          : null;
        const tier = tierEntity
          ? {
              uuid: tierEntity.uuid.toLowerCase(),
              name: tierEntity.displayName,
              rank: tierEntity.rank,
              icon: tierEntity.displayIcon,
            }
          : null;

        skins.push({
          uuid: skin.uuid.toLowerCase(),
          name: skin.displayName,
          tier,
          icon: skin.displayIcon ?? skin.levels[0]?.displayIcon ?? null,
          levels,
          chromas,
        });
      }

      skins.sort((a, b) => a.name.localeCompare(b.name));

      return {
        uuid: weapon.uuid.toLowerCase(),
        name: weapon.displayName,
        category: weapon.shopData?.categoryText ?? weapon.category,
        skinsOwned: skins.length,
        skinsTotal: weapon.skins.length,
        skins,
      };
    });
  }

  private buildCards(): OwnedCard[] {
    const list: OwnedCard[] = [];
    for (const uuid of this.sets.cards) {
      const card = this.catalogue.getCard(uuid);
      if (card) {
        list.push({
          uuid: card.uuid.toLowerCase(),
          name: card.displayName,
          small: card.smallArt,
          wide: card.wideArt,
          large: card.largeArt,
        });
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  private buildTitles(): OwnedTitle[] {
    const list: OwnedTitle[] = [];
    for (const uuid of this.sets.titles) {
      const title = this.catalogue.getTitle(uuid);
      if (title) {
        list.push({
          uuid: title.uuid.toLowerCase(),
          name: title.displayName,
          text: title.titleText,
        });
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  private buildSprays(): OwnedSpray[] {
    const list: OwnedSpray[] = [];
    for (const uuid of this.sets.sprays) {
      const spray = this.catalogue.getSpray(uuid);
      if (spray) {
        list.push({
          uuid: spray.uuid.toLowerCase(),
          name: spray.displayName,
          icon: spray.fullTransparentIcon ?? spray.displayIcon,
        });
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  private buildBuddies(): OwnedBuddy[] {
    const instancesByBuddyUuid = new Map<string, number>();
    for (const [levelUuid, count] of this.sets.buddyLevels.entries()) {
      const resolved = this.catalogue.findBuddyByLevel(levelUuid);
      if (resolved) {
        const buddyUuid = resolved.buddy.uuid.toLowerCase();
        const current = instancesByBuddyUuid.get(buddyUuid) ?? 0;
        instancesByBuddyUuid.set(buddyUuid, current + count);
      }
    }

    const list: OwnedBuddy[] = [];
    for (const [buddyUuid, instances] of instancesByBuddyUuid.entries()) {
      const buddy = this.catalogue.getBuddy(buddyUuid);
      if (buddy) {
        list.push({
          uuid: buddy.uuid.toLowerCase(),
          name: buddy.displayName,
          icon: buddy.displayIcon,
          instances,
        });
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  private buildAgents(): OwnedAgent[] {
    const list: OwnedAgent[] = [];
    for (const uuid of this.sets.agents) {
      const agent = this.catalogue.getAgent(uuid);
      if (agent) {
        list.push({
          uuid: agent.uuid.toLowerCase(),
          name: agent.displayName,
          role: agent.role?.displayName ?? null,
          icon: agent.displayIcon,
        });
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  private extractEntitlementSets(entitlements: RiotEntitlementsResponse): EntitlementSets {
    const skinLevels = new Set<string>();
    const skinChromas = new Set<string>();
    const agents = new Set<string>();
    const buddyLevels = new Map<string, number>();
    const cards = new Set<string>();
    const titles = new Set<string>();
    const sprays = new Set<string>();

    for (const group of entitlements.EntitlementsByTypes) {
      const typeId = group.ItemTypeID.toLowerCase();
      for (const item of group.Entitlements) {
        const itemId = item.ItemID.toLowerCase();
        if (typeId === ENTITLEMENT_ITEM_TYPES.skinLevel.toLowerCase()) {
          skinLevels.add(itemId);
        } else if (typeId === ENTITLEMENT_ITEM_TYPES.skinChroma.toLowerCase()) {
          skinChromas.add(itemId);
        } else if (typeId === ENTITLEMENT_ITEM_TYPES.agent.toLowerCase()) {
          agents.add(itemId);
        } else if (typeId === ENTITLEMENT_ITEM_TYPES.buddy.toLowerCase()) {
          buddyLevels.set(itemId, (buddyLevels.get(itemId) ?? 0) + 1);
        } else if (typeId === ENTITLEMENT_ITEM_TYPES.playerCard.toLowerCase()) {
          cards.add(itemId);
        } else if (typeId === ENTITLEMENT_ITEM_TYPES.playerTitle.toLowerCase()) {
          titles.add(itemId);
        } else if (typeId === ENTITLEMENT_ITEM_TYPES.spray.toLowerCase()) {
          sprays.add(itemId);
        }
      }
    }

    return { skinLevels, skinChromas, agents, buddyLevels, cards, titles, sprays };
  }
}
