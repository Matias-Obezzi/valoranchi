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
