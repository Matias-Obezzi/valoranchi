import type { Catalogue } from "../catalogue/Catalogue.js";
import type { LoadoutChange, LoadoutGunChange } from "../client/LoadoutValidator.js";
import type { Loadout, LoadoutDiff, LoadoutDiffItem, LoadoutGun } from "../model/index.js";

export function exportLoadout(loadout: Loadout): LoadoutChange {
  return {
    guns: loadout.guns.map((g) => ({
      weapon: g.weapon.uuid,
      skin: g.skin.uuid,
      level: g.level.uuid,
      chroma: g.chroma.uuid,
      buddy: g.buddy ? g.buddy.uuid : null,
    })),
    sprays: loadout.sprays.map((s) => s.uuid),
    flex: loadout.flex ? loadout.flex.uuid : null,
    card: loadout.card ? loadout.card.uuid : undefined,
    title: loadout.title ? loadout.title.uuid : undefined,
    incognito: loadout.incognito,
  };
}

function spraySlotName(index: number): string {
  if (index === 0) return "Spray (Round Start)";
  if (index === 1) return "Spray (Mid Round)";
  if (index === 2) return "Spray (Post Round)";
  return `Spray ${index + 1}`;
}

function diffGunsFromTargetLoadout(
  currentGuns: LoadoutGun[],
  targetGuns: LoadoutGun[],
): LoadoutDiffItem[] {
  const items: LoadoutDiffItem[] = [];
  for (const cur of currentGuns) {
    const tar = targetGuns.find(
      (g) => g.weapon.uuid.toLowerCase() === cur.weapon.uuid.toLowerCase(),
    );
    if (!tar) continue;
    if (cur.skin.uuid.toLowerCase() !== tar.skin.uuid.toLowerCase()) {
      items.push({
        slot: cur.weapon.name,
        slotId: cur.weapon.uuid,
        from: { id: cur.skin.uuid, name: cur.skin.name },
        to: { id: tar.skin.uuid, name: tar.skin.name },
      });
    }
    const curBuddyId = cur.buddy?.uuid.toLowerCase() ?? "";
    const tarBuddyId = tar.buddy?.uuid.toLowerCase() ?? "";
    if (curBuddyId !== tarBuddyId) {
      items.push({
        slot: `${cur.weapon.name} (Buddy)`,
        slotId: `${cur.weapon.uuid}:buddy`,
        from: { id: cur.buddy?.uuid ?? "", name: cur.buddy?.name ?? "None" },
        to: { id: tar.buddy?.uuid ?? "", name: tar.buddy?.name ?? "None" },
      });
    }
  }
  return items;
}

function resolveTargetSkin(
  changeSkin: string,
  weaponUuid: string,
  catalogue: Catalogue,
): { uuid: string; name: string } {
  const skin =
    catalogue.getSkin(changeSkin) ??
    catalogue
      .getWeapon(weaponUuid)
      ?.skins.find(
        (s) =>
          s.displayName.toLowerCase() === changeSkin.toLowerCase() ||
          s.uuid.toLowerCase() === changeSkin.toLowerCase(),
      );
  return {
    uuid: skin?.uuid.toLowerCase() ?? changeSkin.toLowerCase(),
    name: skin?.displayName ?? changeSkin,
  };
}

function resolveTargetBuddy(
  changeBuddy: string | null,
  catalogue: Catalogue,
): { uuid: string; name: string } {
  if (!changeBuddy) return { uuid: "", name: "None" };
  const buddy = catalogue.getBuddy(changeBuddy) ?? catalogue.findBuddyByLevel(changeBuddy)?.buddy;
  return {
    uuid: buddy?.uuid.toLowerCase() ?? changeBuddy.toLowerCase(),
    name: buddy?.displayName ?? changeBuddy,
  };
}

function diffGunsFromTargetChange(
  currentGuns: LoadoutGun[],
  gunChanges: LoadoutGunChange[],
  catalogue: Catalogue,
): LoadoutDiffItem[] {
  const items: LoadoutDiffItem[] = [];
  for (const change of gunChanges) {
    const weapon =
      catalogue.getWeapon(change.weapon) ??
      catalogue.weapons.find(
        (w) =>
          w.displayName.toLowerCase() === change.weapon.toLowerCase() ||
          w.uuid.toLowerCase() === change.weapon.toLowerCase(),
      );
    const weaponUuid = weapon?.uuid.toLowerCase() ?? change.weapon.toLowerCase();
    const weaponName = weapon?.displayName ?? change.weapon;

    const cur = currentGuns.find(
      (g) =>
        g.weapon.uuid.toLowerCase() === weaponUuid ||
        g.weapon.name.toLowerCase() === weaponName.toLowerCase(),
    );

    if (change.skin !== undefined) {
      const targetSkin = resolveTargetSkin(change.skin, weaponUuid, catalogue);
      const currentSkinId = cur?.skin.uuid.toLowerCase() ?? "";
      if (currentSkinId !== targetSkin.uuid) {
        items.push({
          slot: weaponName,
          slotId: weaponUuid,
          from: { id: cur?.skin.uuid ?? "", name: cur?.skin.name },
          to: { id: targetSkin.uuid, name: targetSkin.name },
        });
      }
    }

    if (change.buddy !== undefined) {
      const targetBuddy = resolveTargetBuddy(change.buddy, catalogue);
      const currentBuddyId = cur?.buddy?.uuid.toLowerCase() ?? "";
      if (currentBuddyId !== targetBuddy.uuid) {
        items.push({
          slot: `${weaponName} (Buddy)`,
          slotId: `${weaponUuid}:buddy`,
          from: { id: cur?.buddy?.uuid ?? "", name: cur?.buddy?.name ?? "None" },
          to: { id: targetBuddy.uuid, name: targetBuddy.name },
        });
      }
    }
  }
  return items;
}

function diffSprays(
  current: Loadout,
  target: LoadoutChange | Loadout,
  catalogue: Catalogue,
): LoadoutDiffItem[] {
  const items: LoadoutDiffItem[] = [];
  if ("player" in target) {
    const maxLen = Math.max(current.sprays.length, target.sprays.length);
    for (let i = 0; i < maxLen; i++) {
      const cur = current.sprays[i];
      const tar = target.sprays[i];
      if ((cur?.uuid.toLowerCase() ?? "") !== (tar?.uuid.toLowerCase() ?? "")) {
        items.push({
          slot: spraySlotName(i),
          slotId: cur?.slot ?? String(i),
          from: { id: cur?.uuid ?? "", name: cur?.name },
          to: { id: tar?.uuid ?? "", name: tar?.name },
        });
      }
    }
  } else if (target.sprays) {
    for (let i = 0; i < target.sprays.length; i++) {
      const sp = target.sprays[i];
      if (sp === undefined) continue;
      const cur = current.sprays[i];
      const curId = cur?.uuid.toLowerCase() ?? "";
      const entity = sp ? catalogue.getSpray(sp) : undefined;
      const tarId = entity?.uuid.toLowerCase() ?? (sp?.toLowerCase() ?? "");
      if (curId !== tarId) {
        items.push({
          slot: spraySlotName(i),
          slotId: cur?.slot ?? String(i),
          from: { id: cur?.uuid ?? "", name: cur?.name },
          to: { id: entity?.uuid ?? (sp ?? ""), name: entity?.displayName },
        });
      }
    }
  }
  return items;
}

function isFullLoadout(target: LoadoutChange | Loadout): target is Loadout {
  return "player" in target;
}

function diffIdentity(
  current: Loadout,
  target: LoadoutChange | Loadout,
  catalogue: Catalogue,
): LoadoutDiffItem[] {
  const items: LoadoutDiffItem[] = [];

  if (isFullLoadout(target)) {
    const curCard = current.card?.uuid.toLowerCase() ?? "";
    const tarCard = target.card?.uuid.toLowerCase() ?? "";
    if (curCard !== tarCard) {
      items.push({
        slot: "Card",
        slotId: "card",
        from: { id: current.card?.uuid ?? "", name: current.card?.name },
        to: { id: target.card?.uuid ?? "", name: target.card?.name },
      });
    }

    const curTitle = current.title?.uuid.toLowerCase() ?? "";
    const tarTitle = target.title?.uuid.toLowerCase() ?? "";
    if (curTitle !== tarTitle) {
      items.push({
        slot: "Title",
        slotId: "title",
        from: { id: current.title?.uuid ?? "", name: current.title?.name },
        to: { id: target.title?.uuid ?? "", name: target.title?.name },
      });
    }

    const curFlex = current.flex?.uuid.toLowerCase() ?? "";
    const tarFlex = target.flex?.uuid.toLowerCase() ?? "";
    if (curFlex !== tarFlex) {
      items.push({
        slot: "Flex",
        slotId: "flex",
        from: { id: current.flex?.uuid ?? "", name: current.flex?.name },
        to: { id: target.flex?.uuid ?? "", name: target.flex?.name },
      });
    }

    if (target.incognito !== current.incognito) {
      items.push({
        slot: "Incognito",
        slotId: "incognito",
        from: { id: String(current.incognito), name: current.incognito ? "Enabled" : "Disabled" },
        to: { id: String(target.incognito), name: target.incognito ? "Enabled" : "Disabled" },
      });
    }
  } else {
    if (target.card !== undefined) {
      const curCard = current.card?.uuid.toLowerCase() ?? "";
      const cardEntity = catalogue.getCard(target.card);
      const tarCardId = cardEntity?.uuid.toLowerCase() ?? target.card.toLowerCase();
      if (curCard !== tarCardId) {
        items.push({
          slot: "Card",
          slotId: "card",
          from: { id: current.card?.uuid ?? "", name: current.card?.name },
          to: { id: cardEntity?.uuid ?? target.card, name: cardEntity?.displayName },
        });
      }
    }

    if (target.title !== undefined) {
      const curTitle = current.title?.uuid.toLowerCase() ?? "";
      const titleEntity = catalogue.getTitle(target.title);
      const tarTitleId = titleEntity?.uuid.toLowerCase() ?? target.title.toLowerCase();
      if (curTitle !== tarTitleId) {
        items.push({
          slot: "Title",
          slotId: "title",
          from: { id: current.title?.uuid ?? "", name: current.title?.name },
          to: { id: titleEntity?.uuid ?? target.title, name: titleEntity?.displayName },
        });
      }
    }

    if (target.flex !== undefined) {
      const curFlex = current.flex?.uuid.toLowerCase() ?? "";
      const tarFlexId = target.flex?.toLowerCase() ?? "";
      if (curFlex !== tarFlexId) {
        items.push({
          slot: "Flex",
          slotId: "flex",
          from: { id: current.flex?.uuid ?? "", name: current.flex?.name },
          to: { id: target.flex ?? "", name: target.flex ? "Flex" : undefined },
        });
      }
    }

    if (target.incognito !== undefined && target.incognito !== current.incognito) {
      items.push({
        slot: "Incognito",
        slotId: "incognito",
        from: { id: String(current.incognito), name: current.incognito ? "Enabled" : "Disabled" },
        to: { id: String(target.incognito), name: target.incognito ? "Enabled" : "Disabled" },
      });
    }
  }

  return items;
}

export function diffLoadout(
  current: Loadout,
  target: LoadoutChange | Loadout,
  catalogue: Catalogue,
): LoadoutDiff {
  const guns =
    "player" in target
      ? diffGunsFromTargetLoadout(current.guns, target.guns)
      : target.guns
        ? diffGunsFromTargetChange(current.guns, target.guns, catalogue)
        : [];
  const sprays = diffSprays(current, target, catalogue);
  const identity = diffIdentity(current, target, catalogue);

  return {
    guns,
    sprays,
    identity,
    totalChanges: guns.length + sprays.length + identity.length,
  };
}
