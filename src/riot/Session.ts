export interface SessionInit {
  puuid: string;
  accessToken: string;
  entitlementsToken: string;
  region: string;
  shard: string;
  clientVersion: string;
}

const PLATFORM_JSON = JSON.stringify({
  platformType: "PC",
  platformOS: "Windows",
  platformOSVersion: "10.0.19042.1.256.64bit",
  platformChipset: "Unknown",
});

const PLATFORM_HEADER = Buffer.from(PLATFORM_JSON).toString("base64");

export class Session {
  readonly puuid: string;
  readonly accessToken: string;
  readonly entitlementsToken: string;
  readonly region: string;
  readonly shard: string;
  readonly clientVersion: string;

  constructor(init: SessionInit) {
    this.puuid = init.puuid;
    this.accessToken = init.accessToken;
    this.entitlementsToken = init.entitlementsToken;
    this.region = init.region;
    this.shard = init.shard;
    this.clientVersion = init.clientVersion;
    Object.freeze(this);
  }

  get endpoints(): { pd: string; glz: string; shared: string } {
    return {
      pd: `https://pd.${this.shard}.a.pvp.net`,
      glz: `https://glz-${this.region}-1.${this.shard}.a.pvp.net`,
      shared: `https://shared.${this.shard}.a.pvp.net`,
    };
  }

  headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "X-Riot-Entitlements-JWT": this.entitlementsToken,
      "X-Riot-ClientVersion": this.clientVersion,
      "X-Riot-ClientPlatform": PLATFORM_HEADER,
      ...extra,
    };
  }
}
