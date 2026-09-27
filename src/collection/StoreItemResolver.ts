import type { Catalogue } from "../catalogue/Catalogue.js";
import type { StoreItem, Tier } from "../model/index.js";
import { CURRENCY_UUIDS, ENTITLEMENT_ITEM_TYPES } from "../riot/types.js";

const KNOWN_CURRENCIES = new Set(
  Object.values(CURRENCY_UUIDS).map((id) => id.toLowerCase()),
);

export class StoreItemResolver {
  private readonly catalogue: Catalogue;

  constructor(catalogue: Catalogue) {
    this.catalogue = catalogue;
  }

  resolve(
    reward: { ItemTypeID?: string; ItemID?: string; Quantity?: number; Amount?: number } | null | undefined,
  ): StoreItem {
    const itemTypeId = (reward?.ItemTypeID ?? "").toLowerCase();
    const itemId = (reward?.ItemID ?? "").toLowerCase();
    const amount = reward?.Amount ?? reward?.Quantity ?? 1;

    if (!itemTypeId || !itemId) {
      return { kind: "other", uuid: itemId, typeUuid: itemTypeId, name: null };
    }

    if (KNOWN_CURRENCIES.has(itemId) || this.catalogue.getCurrency(itemId)) {
      const currency = this.catalogue.getCurrency(itemId);
      return {
        kind: "currency",
        uuid: itemId,
        name: currency?.displayName ?? "Currency",
        amount,
      };
    }

    if (itemTypeId === ENTITLEMENT_ITEM_TYPES.skinLevel.toLowerCase()) {
      const match = this.catalogue.findSkinAndWeaponByLevel(itemId);
      if (match) {
        return this.buildSkinItem(match.weapon.displayName, match.skin, match.level.displayIcon, match.level.uuid);
      }
      return { kind: "other", uuid: itemId, typeUuid: itemTypeId, name: null };
    }

    if (itemTypeId === ENTITLEMENT_ITEM_TYPES.skinChroma.toLowerCase()) {
      const match = this.catalogue.findSkinAndWeaponByChroma(itemId);
      if (match) {
        return this.buildSkinItem(match.weapon.displayName, match.skin, match.chroma.displayIcon, itemId);
      }
      return { kind: "other", uuid: itemId, typeUuid: itemTypeId, name: null };
    }

    if (itemTypeId === ENTITLEMENT_ITEM_TYPES.buddy.toLowerCase()) {
      const byLevel = this.catalogue.findBuddyByLevel(itemId);
      if (byLevel) {
        return {
          kind: "buddy",
          uuid: byLevel.buddy.uuid.toLowerCase(),
          name: byLevel.buddy.displayName,
          icon: byLevel.level.displayIcon ?? byLevel.buddy.displayIcon ?? null,
        };
      }
      const direct = this.catalogue.getBuddy(itemId);
      if (direct) {
        return {
          kind: "buddy",
          uuid: direct.uuid.toLowerCase(),
          name: direct.displayName,
          icon: direct.displayIcon ?? null,
        };
      }
      return { kind: "other", uuid: itemId, typeUuid: itemTypeId, name: null };
    }

    if (itemTypeId === ENTITLEMENT_ITEM_TYPES.spray.toLowerCase()) {
      const spray = this.catalogue.getSpray(itemId);
      if (spray) {
        return {
          kind: "spray",
          uuid: spray.uuid.toLowerCase(),
          name: spray.displayName,
          icon: spray.fullTransparentIcon ?? spray.displayIcon ?? null,
        };
      }
      return { kind: "other", uuid: itemId, typeUuid: itemTypeId, name: null };
    }

    if (itemTypeId === ENTITLEMENT_ITEM_TYPES.playerCard.toLowerCase()) {
      const card = this.catalogue.getCard(itemId);
      if (card) {
        return {
          kind: "card",
          uuid: card.uuid.toLowerCase(),
          name: card.displayName,
          icon: card.largeArt ?? card.wideArt ?? card.smallArt ?? null,
        };
      }
      return { kind: "other", uuid: itemId, typeUuid: itemTypeId, name: null };
    }

    if (itemTypeId === ENTITLEMENT_ITEM_TYPES.playerTitle.toLowerCase()) {
      const title = this.catalogue.getTitle(itemId);
      if (title) {
        return {
          kind: "title",
          uuid: title.uuid.toLowerCase(),
          name: title.displayName,
          icon: null,
        };
      }
      return { kind: "other", uuid: itemId, typeUuid: itemTypeId, name: null };
    }

    if (itemTypeId === ENTITLEMENT_ITEM_TYPES.agent.toLowerCase()) {
      const agent = this.catalogue.getAgent(itemId);
      if (agent) {
        return {
          kind: "agent",
          uuid: agent.uuid.toLowerCase(),
          name: agent.displayName,
          icon: agent.displayIcon ?? null,
        };
      }
      return { kind: "other", uuid: itemId, typeUuid: itemTypeId, name: null };
    }

    if (itemTypeId === ENTITLEMENT_ITEM_TYPES.flex.toLowerCase()) {
      return {
        kind: "flex",
        uuid: itemId,
        name: "Flex",
        icon: null,
      };
    }

    return { kind: "other", uuid: itemId, typeUuid: itemTypeId, name: null };
  }

  private buildSkinItem(
    weaponName: string,
    skin: { uuid: string; displayName: string; contentTierUuid: string | null; displayIcon: string | null },
    icon: string | null,
    levelUuid: string,
  ): StoreItem {
    const tierEntity = skin.contentTierUuid ? this.catalogue.getTier(skin.contentTierUuid) : null;
    const tier: Tier | null = tierEntity
      ? {
          uuid: tierEntity.uuid.toLowerCase(),
          name: tierEntity.displayName,
          rank: tierEntity.rank,
          icon: tierEntity.displayIcon,
        }
      : null;

    return {
      kind: "skin",
      uuid: skin.uuid.toLowerCase(),
      name: skin.displayName,
      weapon: weaponName,
      tier,
      icon: icon ?? skin.displayIcon ?? null,
      levelUuid: levelUuid.toLowerCase(),
    };
  }
}
