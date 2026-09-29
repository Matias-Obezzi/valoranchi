import type { Catalogue } from "../catalogue/Catalogue.js";
import type { Image, Loadout, LoadoutGun, OwnedCard, OwnedTitle, Player } from "../model/index.js";
import { ENTITLEMENT_ITEM_TYPES, type RiotLoadoutGun, type RiotLoadoutResponse } from "../riot/types.js";

export class LoadoutBuilder {
  private readonly player: Player;
  private readonly raw: RiotLoadoutResponse;
  private readonly catalogue: Catalogue;

  constructor(player: Player, raw: RiotLoadoutResponse, catalogue: Catalogue) {
    this.player = player;
    this.raw = raw;
    this.catalogue = catalogue;
  }

  build(): Loadout {
    const guns: LoadoutGun[] = (this.raw.Guns ?? []).map((gun) => this.buildGun(gun));

    let flex: { uuid: string; name: string; icon: Image } | null = null;
    let sprays: Array<{ slot: string; uuid: string; name: string; icon: Image }>;

    if (this.raw.ActiveExpressions && this.raw.ActiveExpressions.length > 0) {
      const flexEntry = this.raw.ActiveExpressions.find(
        (e) => e.TypeID.toLowerCase() === ENTITLEMENT_ITEM_TYPES.flex.toLowerCase(),
      );
      flex = flexEntry
        ? {
            uuid: flexEntry.AssetID.toLowerCase(),
            name: "Flex",
            icon: null,
          }
        : null;

      const sprayEntries = this.raw.ActiveExpressions.filter(
        (e) => e.TypeID.toLowerCase() === ENTITLEMENT_ITEM_TYPES.spray.toLowerCase(),
      );
      sprays = sprayEntries.map((entry, index) => {
        const spray = this.catalogue.getSpray(entry.AssetID);
        return {
          slot: String(index),
          uuid: entry.AssetID.toLowerCase(),
          name: spray?.displayName ?? "",
          icon: spray?.fullTransparentIcon ?? spray?.displayIcon ?? null,
        };
      });
    } else {
      sprays = (this.raw.Sprays ?? []).map((sp) => {
        const spray = this.catalogue.getSpray(sp.SprayID);
        return {
          slot: sp.EquipSlotID,
          uuid: sp.SprayID.toLowerCase(),
          name: spray?.displayName ?? "",
          icon: spray?.fullTransparentIcon ?? spray?.displayIcon ?? null,
        };
      });
    }

    const cardEntity = this.raw.Identity?.PlayerCardID
      ? this.catalogue.getCard(this.raw.Identity.PlayerCardID)
      : null;
    const card: OwnedCard | null = cardEntity
      ? {
          uuid: cardEntity.uuid.toLowerCase(),
          name: cardEntity.displayName,
          small: cardEntity.smallArt,
          wide: cardEntity.wideArt,
          large: cardEntity.largeArt,
        }
      : null;

    const titleEntity = this.raw.Identity?.PlayerTitleID
      ? this.catalogue.getTitle(this.raw.Identity.PlayerTitleID)
      : null;
    const title: OwnedTitle | null = titleEntity
      ? {
          uuid: titleEntity.uuid.toLowerCase(),
          name: titleEntity.displayName,
          text: titleEntity.titleText,
        }
      : null;

    return {
      player: this.player,
      guns,
      sprays,
      flex,
      card,
      title,
      incognito: Boolean(this.raw.Incognito),
    };
  }

  private buildGun(gun: RiotLoadoutGun): LoadoutGun {
    const weapon = this.catalogue.getWeapon(gun.ID);
    const skin = this.catalogue.getSkin(gun.SkinID);
    const levelMatch = this.catalogue.findSkinAndWeaponByLevel(gun.SkinLevelID);
    const chromaMatch = this.catalogue.findSkinAndWeaponByChroma(gun.ChromaID);

    let buddy: { uuid: string; name: string; icon: string | null } | null = null;
    if (gun.CharmID) {
      const buddyEntity = this.catalogue.getBuddy(gun.CharmID);
      if (buddyEntity) {
        buddy = {
          uuid: buddyEntity.uuid.toLowerCase(),
          name: buddyEntity.displayName,
          icon: buddyEntity.displayIcon,
        };
      }
    } else if (gun.CharmLevelID) {
      const buddyMatch = this.catalogue.findBuddyByLevel(gun.CharmLevelID);
      if (buddyMatch) {
        buddy = {
          uuid: buddyMatch.buddy.uuid.toLowerCase(),
          name: buddyMatch.buddy.displayName,
          icon: buddyMatch.buddy.displayIcon,
        };
      }
    }

    return {
      weapon: {
        uuid: gun.ID.toLowerCase(),
        name: weapon?.displayName ?? "",
      },
      skin: {
        uuid: gun.SkinID.toLowerCase(),
        name: skin?.displayName ?? "",
        icon: skin?.displayIcon ?? null,
      },
      level: {
        uuid: gun.SkinLevelID.toLowerCase(),
        name: levelMatch?.level.displayName ?? "",
      },
      chroma: {
        uuid: gun.ChromaID.toLowerCase(),
        name: chromaMatch?.chroma.displayName ?? "",
      },
      buddy,
    };
  }
}
