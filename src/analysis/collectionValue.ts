import type { Catalogue } from "../catalogue/Catalogue.js";
import type {
  CollectionValue,
  CollectionValueGroup,
  CollectionValueItem,
  Offer,
  OwnedItems,
  OwnedSkin,
  OwnedWeapon,
} from "../model/index.js";

function computeRadianite(skin: OwnedSkin): number {
  const levelsBeyondBase = skin.levels.slice(1).filter((l) => l.owned).length;
  const chromasBeyondBase = skin.chromas.slice(1).filter((c) => c.owned).length;
  return levelsBeyondBase * 10 + chromasBeyondBase * 15;
}

function resolveSkinPrice(
  skin: OwnedSkin,
  offersBySkinUuid: Map<string, number>,
  offersByLevelUuid: Map<string, number>,
): { vp: number | null; source: "offer" | "bundle" | "unknown" } {
  if (skin.tier === null) {
    return { vp: 0, source: "offer" };
  }

  const directOffer = offersBySkinUuid.get(skin.uuid.toLowerCase());
  if (directOffer !== undefined) {
    return { vp: directOffer, source: "offer" };
  }

  for (const level of skin.levels) {
    const levelOffer = offersByLevelUuid.get(level.uuid.toLowerCase());
    if (levelOffer !== undefined) {
      return { vp: levelOffer, source: "offer" };
    }
  }

  return { vp: null, source: "unknown" };
}

function buildValueItem(
  skin: OwnedSkin,
  weapon: OwnedWeapon,
  offersBySkinUuid: Map<string, number>,
  offersByLevelUuid: Map<string, number>,
): CollectionValueItem {
  const { vp, source } = resolveSkinPrice(skin, offersBySkinUuid, offersByLevelUuid);
  const radianite = computeRadianite(skin);

  return {
    skin: {
      uuid: skin.uuid,
      name: skin.name,
      icon: skin.icon,
    },
    weapon: {
      uuid: weapon.uuid,
      name: weapon.name,
    },
    tier: skin.tier,
    vp,
    radianite,
    source,
  };
}

function groupByWeapon(
  items: CollectionValueItem[],
  weapons: OwnedWeapon[],
): CollectionValueGroup[] {
  const groups: CollectionValueGroup[] = [];

  for (const weapon of weapons) {
    const weaponItems = items.filter(
      (item) => item.weapon.uuid.toLowerCase() === weapon.uuid.toLowerCase(),
    );
    const vp = weaponItems.reduce((sum, item) => sum + (item.vp ?? 0), 0);
    const radianite = weaponItems.reduce((sum, item) => sum + item.radianite, 0);
    const priced = weaponItems.filter((item) => item.vp !== null).length;

    groups.push({
      name: weapon.name,
      uuid: weapon.uuid,
      vp,
      radianite,
      items: weaponItems.length,
      priced,
    });
  }

  return groups;
}

function groupByTier(items: CollectionValueItem[]): CollectionValueGroup[] {
  const tierMap = new Map<string, CollectionValueGroup>();

  for (const item of items) {
    const key = item.tier?.uuid.toLowerCase() ?? "standard";
    const name = item.tier?.name ?? "Standard";
    const existing = tierMap.get(key);

    if (existing) {
      existing.vp += item.vp ?? 0;
      existing.radianite += item.radianite;
      existing.items += 1;
      if (item.vp !== null) existing.priced += 1;
    } else {
      tierMap.set(key, {
        name,
        uuid: item.tier?.uuid ?? null,
        vp: item.vp ?? 0,
        radianite: item.radianite,
        items: 1,
        priced: item.vp !== null ? 1 : 0,
      });
    }
  }

  return Array.from(tierMap.values());
}

export function collectionValue(
  owned: OwnedItems,
  offers: Offer[],
  _catalogue: Catalogue,
): CollectionValue {
  const offersBySkinUuid = new Map<string, number>();
  const offersByLevelUuid = new Map<string, number>();

  for (const offer of offers) {
    if (offer.cost.amount > 0 && offer.item.kind === "skin") {
      offersBySkinUuid.set(offer.item.uuid.toLowerCase(), offer.cost.amount);
      if ("levelUuid" in offer.item && offer.item.levelUuid) {
        offersByLevelUuid.set(offer.item.levelUuid.toLowerCase(), offer.cost.amount);
      }
    }
  }

  const items: CollectionValueItem[] = [];
  for (const weapon of owned.weapons) {
    for (const skin of weapon.skins) {
      items.push(buildValueItem(skin, weapon, offersBySkinUuid, offersByLevelUuid));
    }
  }

  const byWeapon = groupByWeapon(items, owned.weapons);
  const byTier = groupByTier(items);

  const totalVp = items.reduce((sum, item) => sum + (item.vp ?? 0), 0);
  const totalRadianite = items.reduce((sum, item) => sum + item.radianite, 0);
  const priced = items.filter((item) => item.vp !== null).length;

  return {
    total: {
      vp: totalVp,
      radianite: totalRadianite,
      priced,
      totalItems: items.length,
    },
    byWeapon,
    byTier,
    items,
  };
}
