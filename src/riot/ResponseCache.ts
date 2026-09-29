import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface Entry<T> {
  at: number;
  value: T;
}

export function defaultResponseCacheDir(): string {
  const base = process.env.LOCALAPPDATA ?? os.tmpdir();
  return path.join(base, "valoranchi-riot-client", "responses");
}

export class FileResponseCache {
  private readonly dir: string;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(
    ttlMs: number,
    dir: string = defaultResponseCacheDir(),
    now: () => number = Date.now,
  ) {
    this.dir = dir;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  async through<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttlMs?: number },
  ): Promise<T> {
    const fresh = this.read<T>(key, options?.ttlMs);
    if (fresh !== undefined) {
      return fresh;
    }
    const value = await fetcher();
    this.write(key, value);
    return value;
  }

  private read<T>(key: string, ttlMs: number = this.ttlMs): T | undefined {
    try {
      const entry = JSON.parse(fs.readFileSync(this.fileFor(key), "utf-8")) as Entry<T>;
      return this.now() - entry.at < ttlMs ? entry.value : undefined;
    } catch {
      return undefined;
    }
  }

  private write<T>(key: string, value: T): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const file = this.fileFor(key);
      fs.writeFileSync(`${file}.tmp`, JSON.stringify({ at: this.now(), value }));
      fs.renameSync(`${file}.tmp`, file);
    } catch {
      return;
    }
  }

  private fileFor(key: string): string {
    return path.join(this.dir, `${createHash("sha1").update(key).digest("hex")}.json`);
  }
}
