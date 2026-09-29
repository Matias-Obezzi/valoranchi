import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseFrame,
  RiotSocket,
  type WebSocketConstructor,
  type WebSocketLike,
} from "../src/local/RiotSocket.js";

class FakeWebSocket implements WebSocketLike {
  static instances: FakeWebSocket[] = [];
  url: string;
  options?: unknown;
  sent: string[] = [];
  closed = false;

  private listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(url: string | URL, options?: unknown) {
    this.url = String(url);
    this.options = options;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.dispatch("close", {});
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: unknown): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) {
      listener(event);
    }
  }
}

describe("parseFrame", () => {
  it("returns null for empty string or whitespace", () => {
    expect(parseFrame("")).toBeNull();
    expect(parseFrame("   ")).toBeNull();
  });

  it("returns null for non-JSON or malformed data", () => {
    expect(parseFrame(null)).toBeNull();
    expect(parseFrame(123)).toBeNull();
    expect(parseFrame("not json")).toBeNull();
    expect(parseFrame("{ bad json }")).toBeNull();
  });

  it("returns null for non-array or incorrect opcodes", () => {
    expect(parseFrame(JSON.stringify({ uri: "/foo" }))).toBeNull();
    expect(parseFrame(JSON.stringify([5, "OnJsonApiEvent"]))).toBeNull();
    expect(parseFrame(JSON.stringify([8, "OtherEvent", {}]))).toBeNull();
  });

  it("returns null when uri or eventType is missing or invalid", () => {
    expect(parseFrame(JSON.stringify([8, "OnJsonApiEvent", {}]))).toBeNull();
    expect(parseFrame(JSON.stringify([8, "OnJsonApiEvent", { uri: "" }]))).toBeNull();
    expect(
      parseFrame(JSON.stringify([8, "OnJsonApiEvent", { uri: "/foo", eventType: "Unknown" }])),
    ).toBeNull();
  });

  it("returns parsed RiotFrame for valid payload", () => {
    const raw = JSON.stringify([
      8,
      "OnJsonApiEvent",
      {
        uri: "/chat/v4/presences",
        eventType: "Update",
        data: { presences: [{ puuid: "p1" }] },
      },
    ]);
    const frame = parseFrame(raw);
    expect(frame).toEqual({
      uri: "/chat/v4/presences",
      eventType: "Update",
      data: { presences: [{ puuid: "p1" }] },
    });
  });
});

describe("RiotSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends subscribe message on open and notifies status transitions", () => {
    const socket = new RiotSocket(1234, "secret", {
      WebSocketImpl: FakeWebSocket as unknown as WebSocketConstructor,
    });

    const statuses: boolean[] = [];
    socket.onStatus((connected) => statuses.push(connected));

    socket.start();
    expect(FakeWebSocket.instances).toHaveLength(1);
    const ws = FakeWebSocket.instances[0]!;

    expect(statuses).toEqual([]);
    ws.dispatch("open", {});

    expect(ws.sent).toEqual([JSON.stringify([5, "OnJsonApiEvent"])]);
    expect(statuses).toEqual([true]);

    // Duplicate open does not re-emit true (transition only)
    ws.dispatch("open", {});
    expect(statuses).toEqual([true]);

    ws.dispatch("close", {});
    expect(statuses).toEqual([true, false]);

    socket.stop();
  });

  it("delivers parsed frames to listeners and ignores unparseable messages", () => {
    const socket = new RiotSocket(() => ({ port: 4321, password: "pw" }), {
      WebSocketImpl: FakeWebSocket as unknown as WebSocketConstructor,
    });

    const received: string[] = [];
    socket.onFrame((frame) => received.push(frame.uri));

    socket.start();
    const ws = FakeWebSocket.instances[0]!;
    ws.dispatch("open", {});

    // Empty frame ignored
    ws.dispatch("message", { data: "" });
    expect(received).toHaveLength(0);

    // Valid frame delivered
    ws.dispatch("message", {
      data: JSON.stringify([
        8,
        "OnJsonApiEvent",
        { uri: "/chat/v4/friends", eventType: "Create", data: {} },
      ]),
    });
    expect(received).toEqual(["/chat/v4/friends"]);

    socket.stop();
  });

  it("schedules reconnect after close using timer and stop cancels it", () => {
    let callCount = 0;
    const socket = new RiotSocket(
      () => {
        callCount++;
        return { port: 5000, password: "pw" };
      },
      {
        WebSocketImpl: FakeWebSocket as unknown as WebSocketConstructor,
        reconnectMs: 3000,
      },
    );

    socket.start();
    expect(callCount).toBe(1);
    const ws = FakeWebSocket.instances[0]!;
    ws.dispatch("open", {});

    ws.dispatch("close", {});
    expect(callCount).toBe(1);

    // Fast-forward before reconnect timeout
    vi.advanceTimersByTime(2000);
    expect(callCount).toBe(1);

    // Fast-forward past reconnect timeout
    vi.advanceTimersByTime(1500);
    expect(callCount).toBe(2);
    expect(FakeWebSocket.instances).toHaveLength(2);

    // stop cancels scheduled reconnect
    const ws2 = FakeWebSocket.instances[1]!;
    ws2.dispatch("close", {});
    socket.stop();

    vi.advanceTimersByTime(5000);
    expect(callCount).toBe(2);
  });

  it("does not throw when credentials resolver returns null, reconnects later", () => {
    let running = false;
    const socket = new RiotSocket(() => (running ? { port: 8080, password: "pw" } : null), {
      WebSocketImpl: FakeWebSocket as unknown as WebSocketConstructor,
      reconnectMs: 2000,
    });

    socket.start();
    expect(FakeWebSocket.instances).toHaveLength(0);

    // Advance timer while still not running
    vi.advanceTimersByTime(2000);
    expect(FakeWebSocket.instances).toHaveLength(0);

    // Now client starts
    running = true;
    vi.advanceTimersByTime(2000);
    expect(FakeWebSocket.instances).toHaveLength(1);

    socket.stop();
  });
});
