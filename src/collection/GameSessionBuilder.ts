import type { GameSession } from "../model/index.js";
import type { RiotSessionResponse } from "../riot/types.js";

export class GameSessionBuilder {
  static build(raw: RiotSessionResponse): GameSession {
    return {
      state: (raw.loopState ?? "").toLowerCase(),
      clientVersion: raw.clientVersion ?? "",
      playtimeMinutes: raw.playtimeMinutes ?? 0,
      restricted: Boolean(raw.isRestricted),
    };
  }
}
