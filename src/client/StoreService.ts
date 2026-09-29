import { StoreBuilder } from "../collection/StoreBuilder.js";
import type { Store } from "../model/index.js";
import type { StoreApi } from "./api.js";
import type { ClientContext } from "./ClientContext.js";

export class StoreService implements StoreApi {
  constructor(private readonly context: ClientContext) {}

  async current(options?: { language?: string }): Promise<Store> {
    const lang = options?.language ?? this.context.language;
    const session = await this.context.sessions.session();
    const api = this.context.api(session);

    const [player, rawStorefront, catalogue] = await Promise.all([
      this.context.player(session),
      api.storefront(),
      this.context.catalogue(lang),
    ]);

    return new StoreBuilder(player, rawStorefront, catalogue, Date.now()).build();
  }
}
