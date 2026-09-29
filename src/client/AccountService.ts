import { CollectionBuilder } from "../collection/CollectionBuilder.js";
import { LoadoutBuilder } from "../collection/LoadoutBuilder.js";
import type { Loadout, OwnedItems, Player, Wallet } from "../model/index.js";
import { CURRENCY_UUIDS } from "../riot/types.js";
import type { ClientContext } from "./ClientContext.js";

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
