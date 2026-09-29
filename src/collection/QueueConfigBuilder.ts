import type { QueueConfig } from "../model/index.js";
import type { RiotQueueConfigsResponse } from "../riot/types.js";

export class QueueConfigBuilder {
  static build(raw: RiotQueueConfigsResponse): QueueConfig[] {
    return (raw.Queues ?? []).map((q) => ({
      id: q.QueueID,
      enabled: Boolean(q.Enabled),
      ranked: Boolean(q.IsRanked),
      teamSize: q.TeamSize,
      minPartySize: q.MinPartySize,
      maxPartySize: q.MaxPartySize,
      mode: q.Mode,
    }));
  }
}
