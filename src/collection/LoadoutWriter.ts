import { ENTITLEMENT_ITEM_TYPES, type RiotLoadoutResponse } from "../riot/types.js";

export interface RiotLoadoutGunPut {
  ID: string;
  SkinID: string;
  SkinLevelID: string;
  ChromaID: string;
  CharmID?: string;
  CharmLevelID?: string;
  CharmInstanceID?: string;
  Attachments: unknown[];
}

export interface RiotLoadoutPutBody {
  Subject: string;
  Version: number;
  Guns: RiotLoadoutGunPut[];
  ActiveExpressions: Array<{ TypeID: string; AssetID: string }>;
  Identity: {
    PlayerCardID: string;
    PlayerTitleID: string;
    AccountLevel: number;
    PreferredLevelBorderID?: string;
    HideAccountLevel: boolean;
  };
  Incognito: boolean;
}

export class LoadoutWriter {
  static buildPutBody(raw: RiotLoadoutResponse): RiotLoadoutPutBody {
    const activeExpressions: Array<{ TypeID: string; AssetID: string }> = [];

    // ActiveExpressions: flex first, then sprays
    const flex = raw.ActiveExpressions?.find(
      (e) => e.TypeID.toLowerCase() === ENTITLEMENT_ITEM_TYPES.flex.toLowerCase(),
    );
    if (flex) {
      activeExpressions.push({
        TypeID: ENTITLEMENT_ITEM_TYPES.flex,
        AssetID: flex.AssetID.toLowerCase(),
      });
    }

    const sprays = (raw.ActiveExpressions ?? []).filter(
      (e) => e.TypeID.toLowerCase() === ENTITLEMENT_ITEM_TYPES.spray.toLowerCase(),
    );
    for (const s of sprays) {
      activeExpressions.push({
        TypeID: ENTITLEMENT_ITEM_TYPES.spray,
        AssetID: s.AssetID.toLowerCase(),
      });
    }

    const guns: RiotLoadoutGunPut[] = (raw.Guns ?? []).map((gun) => ({
      ID: gun.ID.toLowerCase(),
      SkinID: gun.SkinID.toLowerCase(),
      SkinLevelID: gun.SkinLevelID.toLowerCase(),
      ChromaID: gun.ChromaID.toLowerCase(),
      ...(gun.CharmID ? { CharmID: gun.CharmID.toLowerCase() } : {}),
      ...(gun.CharmLevelID ? { CharmLevelID: gun.CharmLevelID.toLowerCase() } : {}),
      ...(gun.CharmInstanceID ? { CharmInstanceID: gun.CharmInstanceID.toLowerCase() } : {}),
      Attachments: [],
    }));

    return {
      Subject: raw.Subject ?? "",
      Version: raw.Version ?? 1,
      Guns: guns,
      ActiveExpressions: activeExpressions,
      Identity: {
        PlayerCardID: raw.Identity.PlayerCardID.toLowerCase(),
        PlayerTitleID: raw.Identity.PlayerTitleID.toLowerCase(),
        AccountLevel: raw.Identity.AccountLevel,
        ...(raw.Identity.PreferredLevelBorderID
          ? { PreferredLevelBorderID: raw.Identity.PreferredLevelBorderID.toLowerCase() }
          : {}),
        HideAccountLevel: Boolean(raw.Identity.HideAccountLevel),
      },
      Incognito: Boolean(raw.Incognito),
    };
  }
}
