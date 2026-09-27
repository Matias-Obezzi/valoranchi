import fs from "node:fs";
import path from "node:path";

export interface LockfileData {
  name: string;
  pid: number;
  port: number;
  password: string;
}

export function defaultLockfilePath(): string | null {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return null;
  }
  return path.join(localAppData, "Riot Games", "Riot Client", "Config", "lockfile");
}

export function parseLockfile(text: string): LockfileData | null {
  const parts = text.trim().split(":");
  if (parts.length !== 4) {
    return null;
  }
  const [name, pidStr, portStr, password] = parts;
  const pid = Number.parseInt(pidStr, 10);
  const port = Number.parseInt(portStr, 10);
  if (!name || Number.isNaN(pid) || Number.isNaN(port) || !password) {
    return null;
  }
  return { name, pid, port, password };
}

export function readLockfile(filePath: string | null = defaultLockfilePath()): LockfileData | null {
  if (!filePath) {
    return null;
  }
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return parseLockfile(content);
  } catch {
    return null;
  }
}
