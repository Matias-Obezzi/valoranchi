import fs from "node:fs";
import path from "node:path";
import type { MatchSummary } from "../model/index.js";

export function loadKnownMatches(cacheDir: string, puuid: string): MatchSummary[] {
  const filePath = path.join(cacheDir, "matches", `${puuid}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
      if (Array.isArray(raw)) {
        return raw as MatchSummary[];
      }
    }
  } catch {
    // Return empty list on read or parse failure
  }
  return [];
}

export function saveKnownMatches(
  cacheDir: string,
  puuid: string,
  matches: MatchSummary[],
): void {
  const dir = path.join(cacheDir, "matches");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${puuid}.json`);
  const tempPath = path.join(dir, `${puuid}.${Date.now()}.tmp`);

  const map = new Map<string, MatchSummary>();
  for (const match of matches) {
    if (match.id) {
      map.set(match.id, match);
    }
  }

  const sorted = Array.from(map.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  const content = JSON.stringify(sorted, null, 2);
  try {
    fs.writeFileSync(tempPath, content, "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch {
    fs.writeFileSync(filePath, content, "utf-8");
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // Ignore temporary file unlink error
    }
  }
}

export async function syncMatches(
  fetcher: (startIndex: number) => Promise<MatchSummary[]>,
  knownIds: Set<string>,
  options?: { maxPages?: number; pageSize?: number },
): Promise<MatchSummary[]> {
  const maxPages = options?.maxPages ?? 5;
  const pageSize = options?.pageSize ?? 20;
  const newlyDiscovered: MatchSummary[] = [];

  for (let page = 0; page < maxPages; page++) {
    const startIndex = page * pageSize;
    const matches = await fetcher(startIndex);
    if (!matches || matches.length === 0) break;

    let hitKnown = false;
    for (const match of matches) {
      if (knownIds.has(match.id)) {
        hitKnown = true;
        break;
      }
      knownIds.add(match.id);
      newlyDiscovered.push(match);
    }

    if (hitKnown || matches.length < pageSize) {
      break;
    }
  }

  return newlyDiscovered;
}
