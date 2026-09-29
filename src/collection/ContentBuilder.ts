import type { Content, ContentEvent, ContentSeason } from "../model/index.js";
import type { RiotContentResponse } from "../riot/types.js";

export class ContentBuilder {
  static build(raw: RiotContentResponse): Content {
    const seasons = raw.Seasons ?? [];
    const actRaw = seasons.find((s) => s.Type.toLowerCase() === "act" && s.IsActive);
    const epRaw = seasons.find((s) => s.Type.toLowerCase() === "episode" && s.IsActive);

    const act: ContentSeason | null = actRaw
      ? {
          id: actRaw.ID,
          name: actRaw.Name,
          isActive: actRaw.IsActive,
          startsAt: actRaw.StartTime,
          endsAt: actRaw.EndTime,
        }
      : null;

    const episode: ContentSeason | null = epRaw
      ? {
          id: epRaw.ID,
          name: epRaw.Name,
          isActive: epRaw.IsActive,
          startsAt: epRaw.StartTime,
          endsAt: epRaw.EndTime,
        }
      : null;

    const events: ContentEvent[] = (raw.Events ?? [])
      .filter((e) => e.IsActive)
      .map((e) => ({
        id: e.ID,
        name: e.Name,
        isActive: e.IsActive,
        startsAt: e.StartTime,
        endsAt: e.EndTime,
      }));

    return { act, episode, events };
  }
}
