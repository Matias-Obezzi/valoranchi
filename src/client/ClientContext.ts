import type { Catalogue } from "../catalogue/Catalogue.js";
import type { ValorantApi } from "../catalogue/ValorantApi.js";
import type { Player } from "../model/index.js";
import type { RiotApi } from "../riot/RiotApi.js";
import type { Session } from "../riot/Session.js";
import type { SessionManager } from "./SessionManager.js";

export interface ClientContext {
  language: string;
  sessions: SessionManager;
  valorantApi: ValorantApi;
  api(session: Session): RiotApi;
  catalogue(language?: string): Promise<Catalogue>;
  player(session: Session): Promise<Player>;
}

export async function createPlayer(api: RiotApi, session: Session): Promise<Player> {
  const [names, accountXp] = await Promise.all([
    api.names([session.puuid]),
    api.accountXp(),
  ]);
  return {
    puuid: session.puuid,
    gameName: names[0]?.GameName ?? "",
    tagLine: names[0]?.TagLine ?? "",
    region: session.region,
    shard: session.shard,
    accountLevel: accountXp.Progress?.Level ?? 0,
  };
}
