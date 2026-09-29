import { CollectionBuilder } from "../collection/CollectionBuilder.js";
import { LoadoutBuilder } from "../collection/LoadoutBuilder.js";
import { LoadoutWriter } from "../collection/LoadoutWriter.js";
import { ValidationError } from "../errors.js";
import type { Loadout, OwnedItems, Player, Wallet } from "../model/index.js";
import { CURRENCY_UUIDS } from "../riot/types.js";
import type { ClientContext } from "./ClientContext.js";
import { LoadoutValidator, type LoadoutChange, type LoadoutGunChange } from "./LoadoutValidator.js";

export class AccountService {
  constructor(private readonly context: ClientContext) {}

  async whoami(): Promise<Player> {
    const session = await this.context.sessions.session();
    return this.context.player(session);
  }

  async ownedItems(options?: { language?: string }): Promise<OwnedItems> {
    const lang = options?.language ?? this.context.language;
    const session = await this.context.sessions.session();
    const api = this.context.api(session);

    const [player, entitlements, catalogue] = await Promise.all([
      this.context.player(session),
      api.entitlements(),
      this.context.catalogue(lang),
    ]);

    return new CollectionBuilder(player, entitlements, catalogue, lang).build();
  }

  async loadout(): Promise<Loadout> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);

    const [player, rawLoadout, catalogue] = await Promise.all([
      this.context.player(session),
      api.loadout(),
      this.context.catalogue(),
    ]);

    return new LoadoutBuilder(player, rawLoadout, catalogue).build();
  }

  async equip(change: LoadoutChange): Promise<Loadout> {
    if (!this.hasLoadoutChanges(change)) {
      return this.loadout();
    }

    const session = await this.context.sessions.session();
    const api = this.context.api(session);

    const [currentRaw, ownedItems, catalogue, rawEntitlements] = await Promise.all([
      api.loadout(),
      this.ownedItems(),
      this.context.catalogue(),
      api.entitlements(),
    ]);

    const validatedRaw = LoadoutValidator.validate(
      currentRaw,
      ownedItems,
      catalogue,
      rawEntitlements,
      change,
    );

    const putBody = LoadoutWriter.buildPutBody(validatedRaw);
    await api.putLoadout(putBody);
    api.invalidateLoadout();
    return this.loadout();
  }

  async equipCollection(skinUuids: string[]): Promise<Loadout> {
    if (!skinUuids || skinUuids.length === 0) {
      return this.loadout();
    }

    const catalogue = await this.context.catalogue();
    const seenWeapons = new Set<string>();
    const gunChanges: LoadoutGunChange[] = [];

    for (const skinUuid of skinUuids) {
      const skin = catalogue.getSkin(skinUuid);
      if (!skin) {
        throw new ValidationError("unknown-item", `Unknown skin: ${skinUuid}`, { skin: skinUuid });
      }

      const weapon = catalogue.weapons.find((w) =>
        w.skins.some((s) => s.uuid.toLowerCase() === skin.uuid.toLowerCase()),
      );
      if (!weapon) {
        throw new ValidationError("unknown-weapon", `No weapon found for skin: ${skin.displayName}`);
      }

      const weaponKey = weapon.uuid.toLowerCase();
      if (seenWeapons.has(weaponKey)) {
        throw new ValidationError(
          "duplicate-weapon",
          `Multiple skins specified for weapon ${weapon.displayName}`,
          { weapon: weapon.uuid, skin: skin.uuid },
        );
      }
      seenWeapons.add(weaponKey);

      gunChanges.push({
        weapon: weapon.uuid,
        skin: skin.uuid,
      });
    }

    return this.equip({ guns: gunChanges });
  }

  private hasLoadoutChanges(change?: LoadoutChange): boolean {
    if (!change) return false;
    return Boolean(
      change.guns?.length ||
        change.sprays?.length ||
        change.flex !== undefined ||
        change.card ||
        change.title ||
        change.levelBorder ||
        change.incognito !== undefined ||
        change.hideAccountLevel !== undefined,
    );
  }

  async wallet(): Promise<Wallet> {
    const session = await this.context.sessions.session();
    const rawWallet = await this.context.api(session).wallet();
    const balances = rawWallet.Balances ?? {};

    return {
      valorantPoints: balances[CURRENCY_UUIDS.valorantPoints] ?? 0,
      radianite: balances[CURRENCY_UUIDS.radianite] ?? 0,
      kingdomCredits: balances[CURRENCY_UUIDS.kingdomCredits] ?? 0,
    };
  }
}
