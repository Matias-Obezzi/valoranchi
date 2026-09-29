import type { Catalogue } from "../catalogue/Catalogue.js";
import type { CustomGameConfigs } from "../model/index.js";
import type { RiotCustomGameConfigsResponse } from "../riot/types.js";

const MODE_NAMES: Record<string, string> = {
  bomb: "Standard",
  quickbomb: "Spike Rush",
  bombquick: "Spike Rush",
  deathmatch: "Deathmatch",
  onefa: "Replication",
  snowball: "Snowball Fight",
  gungame: "Escalation",
  escalation: "Escalation",
  swiftplay: "Swiftplay",
  hurm: "Team Deathmatch",
  teamdeathmatch: "Team Deathmatch",
  newmap: "New Map",
};

export class CustomGameConfigsBuilder {
  static build(
    raw: RiotCustomGameConfigsResponse,
    catalogue: Catalogue,
    pingMap?: Record<string, number>,
  ): CustomGameConfigs {
    const maps = (raw.EnabledMaps ?? []).map((path) => ({
      path,
      name: catalogue.getMapByPath(path)?.displayName ?? path.split("/").pop() ?? path,
    }));

    const modes = (raw.EnabledModes ?? []).map((path) => ({
      path,
      name: this.resolveModeName(path),
    }));

    const servers = this.resolveServers(raw.GamePodPingServiceInfo, pingMap);

    return { maps, modes, servers };
  }

  private static resolveModeName(path: string): string {
    const lower = path.toLowerCase();
    for (const [key, name] of Object.entries(MODE_NAMES)) {
      if (lower.includes(key)) {
        return name;
      }
    }
    const filename = path.split("/").pop()?.split(".")[0] ?? path;
    return filename.replace(/GameMode/gi, "").trim() || path;
  }

  private static resolveServers(
    info: unknown,
    pingMap?: Record<string, number>,
  ): Array<{ id: string; name: string; ping: number | null }> {
    if (!info || typeof info !== "object") {
      return [];
    }
    return Object.entries(info as Record<string, { ServerTextName?: string }>).map(([id, pod]) => ({
      id,
      name: pod?.ServerTextName ?? id,
      ping: typeof pingMap?.[id] === "number" ? pingMap[id] : null,
    }));
  }
}
