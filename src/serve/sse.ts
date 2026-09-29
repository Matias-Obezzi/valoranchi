import type { IncomingMessage, ServerResponse } from "node:http";
import type { RiotEventMap } from "../events/RiotEvents.js";
import type { RiotClient } from "../RiotClient.js";
import type { FriendsWatchEventMap, MatchWatchEventMap } from "../watch/types.js";

const CLIENT_EVENT_NAMES = [
  "connected",
  "disconnected",
  "friend:presence",
  "friend:added",
  "friend:removed",
  "friend:request",
  "message",
  "party",
  "game",
  "self:state",
  "raw",
  "error",
] as const;

const MATCH_EVENT_NAMES = ["pregame", "locked", "started", "round", "ended", "left"] as const;

const FRIENDS_EVENT_NAMES = ["online", "offline", "in-game", "out-of-game"] as const;

export function handleSse(
  client: RiotClient,
  req: IncomingMessage,
  res: ServerResponse,
  query: Record<string, string>,
): void {
  const onlyParam = query.only;
  const allowed = onlyParam
    ? new Set(
        onlyParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : null;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendEvent = (eventName: string, data?: unknown) => {
    if (allowed && !allowed.has(eventName)) return;
    const payload =
      data instanceof Error
        ? { name: data.name, message: data.message }
        : data !== undefined
          ? data
          : null;
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  const pingTimer = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  const cleanups: Array<() => void> = [() => clearInterval(pingTimer)];

  const events = client.events();
  for (const name of CLIENT_EVENT_NAMES) {
    if (allowed && !allowed.has(name)) continue;
    const listener = (...args: unknown[]) => {
      sendEvent(name, args[0]);
    };
    const evtName = name as keyof RiotEventMap;
    events.on(evtName, listener as (...args: RiotEventMap[typeof evtName]) => void);
    cleanups.push(() =>
      events.off(evtName, listener as (...args: RiotEventMap[typeof evtName]) => void),
    );
  }

  const needsMatch = !allowed || MATCH_EVENT_NAMES.some((n) => allowed.has(n));
  if (needsMatch) {
    const matchWatcher = client.watch.match().start();
    for (const name of MATCH_EVENT_NAMES) {
      if (allowed && !allowed.has(name)) continue;
      const listener = (...args: unknown[]) => {
        sendEvent(name, args[0]);
      };
      const evtName = name as keyof MatchWatchEventMap;
      matchWatcher.on(evtName, listener as (...args: MatchWatchEventMap[typeof evtName]) => void);
    }
    cleanups.push(() => matchWatcher.stop());
  }

  const needsFriends = !allowed || FRIENDS_EVENT_NAMES.some((n) => allowed.has(n));
  if (needsFriends) {
    const friendsWatcher = client.watch.friends().start();
    for (const name of FRIENDS_EVENT_NAMES) {
      if (allowed && !allowed.has(name)) continue;
      const listener = (...args: unknown[]) => {
        sendEvent(name, args[0]);
      };
      const evtName = name as keyof FriendsWatchEventMap;
      friendsWatcher.on(
        evtName,
        listener as (...args: FriendsWatchEventMap[typeof evtName]) => void,
      );
    }
    cleanups.push(() => friendsWatcher.stop());
  }

  req.on("close", () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  });
}
