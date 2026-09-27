import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ValorantApiCatalogueData } from "./types.js";

export interface StoredCatalogue {
  version: string;
  data: ValorantApiCatalogueData;
}

export function defaultCatalogueDir(): string {
  const base = process.env.LOCALAPPDATA ?? os.tmpdir();
  return path.join(base, "valoranchi-riot-client", "catalogue");
}

export class FileCatalogueStore {
  private readonly dir: string;

  constructor(dir: string = defaultCatalogueDir()) {
    this.dir = dir;
  }

  read(language: string): StoredCatalogue | null {
    try {
      const text = fs.readFileSync(this.fileFor(language), "utf-8");
      const parsed = JSON.parse(text) as Partial<StoredCatalogue>;
      return parsed.version && parsed.data ? (parsed as StoredCatalogue) : null;
    } catch {
      return null;
    }
  }

  write(language: string, stored: StoredCatalogue): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const file = this.fileFor(language);
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(stored));
      fs.renameSync(`${file}.tmp`, file);
    } catch {
      return;
    }
  }

  private fileFor(language: string): string {
    return path.join(this.dir, `${language.replace(/[^a-zA-Z-]/g, "_")}.json`);
  }
}
