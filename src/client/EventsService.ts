import { RiotEvents } from "../events/RiotEvents.js";
import { ChatApi } from "../local/ChatApi.js";
import type { RiotClientLocalApi } from "../local/RiotClientLocalApi.js";
import { RiotSocket } from "../local/RiotSocket.js";
import type { ClientContext } from "./ClientContext.js";

export class EventsService {
  private cachedEvents: RiotEvents | null = null;

  constructor(private readonly context: ClientContext) {}

  events(): RiotEvents {
    if (this.cachedEvents) {
      return this.cachedEvents;
    }

    const socket = new RiotSocket(() => this.context.sessions.credentials());

    const dynamicLocalApi = {
      get: <T>(path: string) => {
        try {
          return this.context.sessions.localApi().get<T>(path);
        } catch {
          return Promise.resolve(null);
        }
      },
    } as unknown as RiotClientLocalApi;

    const chatApi = new ChatApi(dynamicLocalApi);
    const catalogueLoader = () => this.context.catalogue();
    const puuidResolver = () => this.resolveEventPuuid(chatApi);

    this.cachedEvents = new RiotEvents(socket, chatApi, catalogueLoader, puuidResolver);
    this.cachedEvents.start();
    return this.cachedEvents;
  }

  close(): void {
    if (this.cachedEvents) {
      this.cachedEvents.stop();
      this.cachedEvents = null;
    }
  }

  private async resolveEventPuuid(chatApi: ChatApi): Promise<string | null> {
    try {
      const session = await chatApi.session();
      if (session?.puuid) return session.puuid;
    } catch {}
    try {
      const session = await this.context.sessions.session();
      return session.puuid;
    } catch {
      return null;
    }
  }
}
