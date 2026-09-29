import fs from "node:fs";
import path from "node:path";
import type { Store, StoreHistory, StoreHistoryDay, StoreSeen } from "../model/index.js";

export function recordStoreRotation(
  history: StoreHistory,
  currentStore: Store,
  date: Date = new Date(),
): StoreHistory {
  const day = date.toISOString().slice(0, 10);
  const daily = currentStore.daily?.offers.map((o) => o.item.uuid.toLowerCase()) ?? [];
  const nightMarket = currentStore.nightMarket
    ? currentStore.nightMarket.offers.map((o) => o.item.uuid.toLowerCase())
    : null;
  const bundles = currentStore.bundles
    ? currentStore.bundles.items.map((b) => b.uuid.toLowerCase())
    : null;

  const newDay: StoreHistoryDay = { day, daily, nightMarket, bundles };

  const existingIndex = history.days.findIndex((d) => d.day === day);
  let days: StoreHistoryDay[];
  if (existingIndex >= 0) {
    days = [...history.days];
    days[existingIndex] = newDay;
  } else {
    days = [...history.days, newDay];
  }

  if (days.length > 400) {
    days = days.slice(-400);
  }

  return { days };
}

export function querySkinSeen(history: StoreHistory, skinUuid: string): StoreSeen {
  const target = skinUuid.toLowerCase();
  let times = 0;
  let lastSeen: string | null = null;

  for (const day of history.days) {
    if (day.daily.some((id) => id.toLowerCase() === target)) {
      times++;
      lastSeen = day.day;
    }
  }

  return { lastSeen, times };
}

export function loadStoreHistory(cacheDir: string, puuid: string): StoreHistory {
  const filePath = path.join(cacheDir, "storeHistory", `${puuid}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
      if (
        raw &&
        typeof raw === "object" &&
        "days" in raw &&
        Array.isArray((raw as StoreHistory).days)
      ) {
        return { days: (raw as StoreHistory).days };
      }
    }
  } catch {}
  return { days: [] };
}

export function saveStoreHistory(cacheDir: string, puuid: string, history: StoreHistory): void {
  const dir = path.join(cacheDir, "storeHistory");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${puuid}.json`);
  const tempPath = path.join(dir, `${puuid}.${Date.now()}.tmp`);
  const content = JSON.stringify(history, null, 2);

  try {
    fs.writeFileSync(tempPath, content, "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch {
    fs.writeFileSync(filePath, content, "utf-8");
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
  }
}
