import type { Catalogue } from "../catalogue/Catalogue.js";
import { ValidationError } from "../errors.js";
import type { OwnedItems } from "../model/index.js";
import {
  ENTITLEMENT_ITEM_TYPES,
  type RiotActiveExpression,
  type RiotEntitlementsResponse,
  type RiotLoadoutGun,
  type RiotLoadoutResponse,
} from "../riot/types.js";

export interface LoadoutGunChange {
  weapon: string;
  skin?: string;
  level?: string;
  chroma?: string;
  buddy?: string | null;
}

export interface LoadoutChange {
  guns?: LoadoutGunChange[];
  sprays?: Array<string | null | undefined>;
  flex?: string | null;
  card?: string;
  title?: string;
  levelBorder?: string;
  incognito?: boolean;
  hideAccountLevel?: boolean;
}

export class LoadoutValidator {
  static validate(
    currentRaw: RiotLoadoutResponse,
    ownedItems: OwnedItems,
    catalogue: Catalogue,
    rawEntitlements: RiotEntitlementsResponse,
    change: LoadoutChange,
  ): RiotLoadoutResponse {
    const nextGuns: RiotLoadoutGun[] = (currentRaw.Guns ?? []).map((g) => ({ ...g }));
    const nextIdentity = { ...currentRaw.Identity };
    let nextIncognito = Boolean(currentRaw.Incognito);

    let currentFlexUuid: string | null = null;
    const currentSprayUuids: Array<string | null> = [null, null, null];

    if (currentRaw.ActiveExpressions) {
      const f = currentRaw.ActiveExpressions.find(
        (e) => e.TypeID.toLowerCase() === ENTITLEMENT_ITEM_TYPES.flex.toLowerCase(),
      );
      if (f) currentFlexUuid = f.AssetID.toLowerCase();

      const sprays = currentRaw.ActiveExpressions.filter(
        (e) => e.TypeID.toLowerCase() === ENTITLEMENT_ITEM_TYPES.spray.toLowerCase(),
      );
      for (let i = 0; i < Math.min(sprays.length, 3); i++) {
        currentSprayUuids[i] = sprays[i]!.AssetID.toLowerCase();
      }
    } else if (currentRaw.Sprays) {
      for (let i = 0; i < Math.min(currentRaw.Sprays.length, 3); i++) {
        currentSprayUuids[i] = currentRaw.Sprays[i]!.SprayID.toLowerCase();
      }
    }

    if (change.card !== undefined) {
      const card = catalogue.getCard(change.card);
      if (!card) {
        throw new ValidationError("unknown-item", `Unknown card: ${change.card}`, {
          card: change.card,
        });
      }
      const cardOwned = ownedItems.cards.some(
        (c) => c.uuid.toLowerCase() === card.uuid.toLowerCase(),
      );
      if (!cardOwned) {
        throw new ValidationError("card-not-owned", `Card is not owned`, { card: change.card });
      }
      nextIdentity.PlayerCardID = card.uuid.toLowerCase();
    }

    if (change.title !== undefined) {
      const title = catalogue.getTitle(change.title);
      if (!title) {
        throw new ValidationError("unknown-item", `Unknown title: ${change.title}`, {
          title: change.title,
        });
      }
      const titleOwned = ownedItems.titles.some(
        (t) => t.uuid.toLowerCase() === title.uuid.toLowerCase(),
      );
      if (!titleOwned) {
        throw new ValidationError("title-not-owned", `Title is not owned`, { title: change.title });
      }
      nextIdentity.PlayerTitleID = title.uuid.toLowerCase();
    }

    if (change.levelBorder !== undefined) {
      const border = catalogue.getLevelBorder(change.levelBorder);
      if (!border) {
        throw new ValidationError("unknown-item", `Unknown border: ${change.levelBorder}`, {
          levelBorder: change.levelBorder,
        });
      }
      const accountLevel = ownedItems.player?.accountLevel ?? nextIdentity.AccountLevel ?? 0;
      if (border.startingLevel > accountLevel) {
        throw new ValidationError(
          "border-too-high",
          `Level border requires level ${border.startingLevel}, current level is ${accountLevel}`,
          { levelBorder: change.levelBorder, startingLevel: border.startingLevel, accountLevel },
        );
      }
      nextIdentity.PreferredLevelBorderID = border.uuid.toLowerCase();
    }

    if (change.hideAccountLevel !== undefined) {
      nextIdentity.HideAccountLevel = Boolean(change.hideAccountLevel);
    }

    if (change.incognito !== undefined) {
      nextIncognito = Boolean(change.incognito);
    }

    if (change.flex !== undefined) {
      if (change.flex === null) {
        currentFlexUuid = null;
      } else {
        const flexUuid = change.flex.toLowerCase();
        const flexCat = rawEntitlements.EntitlementsByTypes?.find(
          (cat) => cat.ItemTypeID.toLowerCase() === ENTITLEMENT_ITEM_TYPES.flex.toLowerCase(),
        );
        const ownedFlex = flexCat?.Entitlements.some((e) => e.ItemID.toLowerCase() === flexUuid);
        if (!ownedFlex) {
          throw new ValidationError("flex-not-owned", `Flex item is not owned: ${change.flex}`, {
            flex: change.flex,
          });
        }
        currentFlexUuid = flexUuid;
      }
    }

    if (change.sprays !== undefined) {
      if (change.sprays.length > 3) {
        throw new ValidationError("too-many-sprays", "Sprays array cannot exceed 3 slots", {
          count: change.sprays.length,
        });
      }
      for (let i = 0; i < change.sprays.length; i++) {
        const sp = change.sprays[i];
        if (sp === null) {
          currentSprayUuids[i] = null;
        } else if (sp !== undefined) {
          const sprayEntity = catalogue.getSpray(sp);
          if (!sprayEntity) {
            throw new ValidationError("unknown-item", `Unknown spray: ${sp}`, { spray: sp });
          }
          const sprayOwned = ownedItems.sprays.some(
            (s) => s.uuid.toLowerCase() === sprayEntity.uuid.toLowerCase(),
          );
          if (!sprayOwned) {
            throw new ValidationError("spray-not-owned", `Spray is not owned: ${sp}`, {
              spray: sp,
            });
          }
          currentSprayUuids[i] = sprayEntity.uuid.toLowerCase();
        }
      }
    }

    if (change.guns && change.guns.length > 0) {
      this.validateGuns(nextGuns, ownedItems, catalogue, rawEntitlements, change.guns);
    }

    const nextActiveExpressions: RiotActiveExpression[] = [];
    if (currentFlexUuid) {
      nextActiveExpressions.push({
        TypeID: ENTITLEMENT_ITEM_TYPES.flex,
        AssetID: currentFlexUuid,
      });
    }
    for (const sp of currentSprayUuids) {
      if (sp) {
        nextActiveExpressions.push({
          TypeID: ENTITLEMENT_ITEM_TYPES.spray,
          AssetID: sp,
        });
      }
    }

    return {
      Subject: currentRaw.Subject,
      Version: currentRaw.Version,
      Guns: nextGuns,
      ActiveExpressions: nextActiveExpressions,
      Identity: nextIdentity,
      Incognito: nextIncognito,
    };
  }

  private static validateGuns(
    nextGuns: RiotLoadoutGun[],
    ownedItems: OwnedItems,
    catalogue: Catalogue,
    rawEntitlements: RiotEntitlementsResponse,
    gunChanges: LoadoutGunChange[],
  ): void {
    const changingWeaponUuids = new Set<string>();
    const resolvedChanges: Array<{
      targetGun: RiotLoadoutGun;
      weaponUuid: string;
      skinUuid: string;
      levelUuid: string;
      chromaUuid: string;
      buddyUuid?: string | null;
    }> = [];

    for (const change of gunChanges) {
      let weapon = catalogue.getWeapon(change.weapon);
      if (!weapon) {
        weapon = catalogue.weapons.find(
          (w) => w.displayName.toLowerCase() === change.weapon.toLowerCase(),
        );
      }
      if (!weapon) {
        throw new ValidationError("unknown-weapon", `Unknown weapon: ${change.weapon}`, {
          weapon: change.weapon,
        });
      }

      let skinUuid: string;
      let levelUuid: string;
      let chromaUuid: string;

      if (change.skin) {
        const skin = catalogue.getSkin(change.skin);
        if (!skin) {
          throw new ValidationError("unknown-item", `Unknown skin: ${change.skin}`, {
            skin: change.skin,
          });
        }

        if (!weapon.skins.some((s) => s.uuid.toLowerCase() === skin.uuid.toLowerCase())) {
          throw new ValidationError(
            "skin-not-for-weapon",
            `Skin ${skin.displayName} is not for weapon ${weapon.displayName}`,
            { weapon: weapon.uuid, skin: skin.uuid },
          );
        }

        const isDefaultSkin = skin.contentTierUuid === null || !skin.contentTierUuid;
        const ownedWeapon = ownedItems.weapons.find(
          (w) => w.uuid.toLowerCase() === weapon!.uuid.toLowerCase(),
        );
        const ownedSkin = ownedWeapon?.skins.find(
          (s) => s.uuid.toLowerCase() === skin.uuid.toLowerCase(),
        );

        if (!isDefaultSkin && !ownedSkin?.levels.some((l) => l.owned)) {
          throw new ValidationError("skin-not-owned", `Skin is not owned: ${skin.displayName}`, {
            skin: skin.uuid,
          });
        }

        skinUuid = skin.uuid.toLowerCase();
        levelUuid = this.resolveLevel(change.level, skin, isDefaultSkin, ownedSkin, catalogue);
        chromaUuid = this.resolveChroma(change.chroma, skin, isDefaultSkin, ownedSkin, catalogue);
      } else {
        const existingGun = nextGuns.find((g) => g.ID.toLowerCase() === weapon!.uuid.toLowerCase());
        if (!existingGun) {
          throw new ValidationError(
            "unknown-item",
            `No skin found for weapon: ${weapon.displayName}`,
          );
        }
        skinUuid = existingGun.SkinID;
        levelUuid = existingGun.SkinLevelID;
        chromaUuid = existingGun.ChromaID;
      }

      let targetGun = nextGuns.find((g) => g.ID.toLowerCase() === weapon!.uuid.toLowerCase());
      if (!targetGun) {
        targetGun = {
          ID: weapon.uuid.toLowerCase(),
          SkinID: skinUuid,
          SkinLevelID: levelUuid,
          ChromaID: chromaUuid,
          Attachments: [],
        };
        nextGuns.push(targetGun);
      }

      changingWeaponUuids.add(weapon.uuid.toLowerCase());
      resolvedChanges.push({
        targetGun,
        weaponUuid: weapon.uuid.toLowerCase(),
        skinUuid,
        levelUuid,
        chromaUuid,
        buddyUuid: change.buddy,
      });
    }

    const usedInstances = new Set<string>();
    for (const g of nextGuns) {
      if (g.CharmInstanceID && !changingWeaponUuids.has(g.ID.toLowerCase())) {
        usedInstances.add(g.CharmInstanceID.toLowerCase());
      }
    }

    for (const resolved of resolvedChanges) {
      const { targetGun, weaponUuid, skinUuid, levelUuid, chromaUuid, buddyUuid } = resolved;
      targetGun.ID = weaponUuid;
      targetGun.SkinID = skinUuid;
      targetGun.SkinLevelID = levelUuid;
      targetGun.ChromaID = chromaUuid;

      if (buddyUuid === null) {
        targetGun.CharmID = undefined;
        targetGun.CharmLevelID = undefined;
        targetGun.CharmInstanceID = undefined;
      } else if (buddyUuid !== undefined) {
        const buddy = catalogue.getBuddy(buddyUuid);
        if (!buddy) {
          throw new ValidationError("unknown-item", `Unknown buddy: ${buddyUuid}`, {
            buddy: buddyUuid,
          });
        }

        const instances = this.getBuddyInstances(buddy.uuid, catalogue, rawEntitlements);
        if (instances.length === 0) {
          throw new ValidationError("buddy-not-owned", `Buddy is not owned: ${buddy.displayName}`, {
            buddy: buddyUuid,
          });
        }

        const freeInstance = instances.find((inst) => !usedInstances.has(inst));
        if (!freeInstance) {
          throw new ValidationError(
            "buddy-instances-exhausted",
            `All instances of buddy ${buddy.displayName} are already equipped`,
            { buddy: buddyUuid, total: instances.length },
          );
        }

        usedInstances.add(freeInstance);
        targetGun.CharmID = buddy.uuid.toLowerCase();
        targetGun.CharmLevelID = buddy.levels[0]?.uuid.toLowerCase();
        targetGun.CharmInstanceID = freeInstance;
      } else if (targetGun.CharmInstanceID) {
        usedInstances.add(targetGun.CharmInstanceID.toLowerCase());
      }
    }
  }

  private static resolveLevel(
    requestedLevel: string | undefined,
    skin: { uuid: string; levels: Array<{ uuid: string }> },
    isDefaultSkin: boolean,
    ownedSkin: { levels: Array<{ uuid: string; owned: boolean }> } | undefined,
    catalogue: Catalogue,
  ): string {
    if (requestedLevel) {
      const levelEntity = catalogue.findSkinAndWeaponByLevel(requestedLevel);
      if (!levelEntity) {
        throw new ValidationError("unknown-item", `Unknown level: ${requestedLevel}`, {
          level: requestedLevel,
        });
      }
      if (levelEntity.skin.uuid.toLowerCase() !== skin.uuid.toLowerCase()) {
        throw new ValidationError("level-not-owned", `Level does not belong to skin`, {
          level: requestedLevel,
          skin: skin.uuid,
        });
      }
      const owned = isDefaultSkin
        ? levelEntity.level.uuid.toLowerCase() === skin.levels[0]?.uuid.toLowerCase()
        : Boolean(
            ownedSkin?.levels.find((l) => l.uuid.toLowerCase() === requestedLevel.toLowerCase())
              ?.owned,
          );
      if (!owned) {
        throw new ValidationError("level-not-owned", `Level is not owned`, {
          level: requestedLevel,
        });
      }
      return levelEntity.level.uuid.toLowerCase();
    }

    if (isDefaultSkin) {
      return skin.levels[0]?.uuid.toLowerCase() ?? skin.uuid.toLowerCase();
    }

    const ownedLevelSet = new Set(
      ownedSkin?.levels.filter((l) => l.owned).map((l) => l.uuid.toLowerCase()) ?? [],
    );
    const highest = [...skin.levels].reverse().find((l) => ownedLevelSet.has(l.uuid.toLowerCase()));
    return highest?.uuid.toLowerCase() ?? skin.levels[0]!.uuid.toLowerCase();
  }

  private static resolveChroma(
    requestedChroma: string | undefined,
    skin: { uuid: string; chromas: Array<{ uuid: string }> },
    _isDefaultSkin: boolean,
    ownedSkin: { chromas: Array<{ uuid: string; owned: boolean }> } | undefined,
    catalogue: Catalogue,
  ): string {
    const baseChromaUuid = skin.chromas[0]!.uuid.toLowerCase();
    if (requestedChroma) {
      const chromaEntity = catalogue.findSkinAndWeaponByChroma(requestedChroma);
      if (!chromaEntity) {
        throw new ValidationError("unknown-item", `Unknown chroma: ${requestedChroma}`, {
          chroma: requestedChroma,
        });
      }
      if (chromaEntity.skin.uuid.toLowerCase() !== skin.uuid.toLowerCase()) {
        throw new ValidationError("chroma-not-for-skin", `Chroma does not belong to skin`, {
          chroma: requestedChroma,
          skin: skin.uuid,
        });
      }
      const isBase = chromaEntity.chroma.uuid.toLowerCase() === baseChromaUuid;
      const owned =
        isBase ||
        Boolean(
          ownedSkin?.chromas.find((c) => c.uuid.toLowerCase() === requestedChroma.toLowerCase())
            ?.owned,
        );
      if (!owned) {
        throw new ValidationError("chroma-not-owned", `Chroma is not owned`, {
          chroma: requestedChroma,
        });
      }
      return chromaEntity.chroma.uuid.toLowerCase();
    }

    return baseChromaUuid;
  }

  private static getBuddyInstances(
    buddyUuid: string,
    catalogue: Catalogue,
    rawEntitlements: RiotEntitlementsResponse,
  ): string[] {
    const buddy = catalogue.getBuddy(buddyUuid);
    if (!buddy) return [];
    const levelUuids = new Set(buddy.levels.map((l) => l.uuid.toLowerCase()));
    levelUuids.add(buddy.uuid.toLowerCase());

    const buddyCat = rawEntitlements.EntitlementsByTypes?.find(
      (cat) => cat.ItemTypeID.toLowerCase() === ENTITLEMENT_ITEM_TYPES.buddy.toLowerCase(),
    );
    if (!buddyCat) return [];

    const instances: string[] = [];
    for (const ent of buddyCat.Entitlements) {
      if (levelUuids.has(ent.ItemID.toLowerCase()) && ent.InstanceID) {
        instances.push(ent.InstanceID.toLowerCase());
      }
    }
    return instances;
  }
}
