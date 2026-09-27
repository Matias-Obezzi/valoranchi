import type { HttpGateway } from "./HttpGateway.js";
import type { Session } from "./Session.js";
import type {
  RiotEntitlementsResponse,
  RiotLoadoutResponse,
  RiotNameResponse,
  RiotWalletResponse,
} from "./types.js";

export class RiotApi {
  private readonly gateway: HttpGateway;
  private readonly session: Session;

  constructor(gateway: HttpGateway, session: Session) {
    this.gateway = gateway;
    this.session = session;
  }

  async entitlements(): Promise<RiotEntitlementsResponse> {
    const url = `${this.session.endpoints.pd}/store/v1/entitlements/${this.session.puuid}`;
    return this.gateway.get<RiotEntitlementsResponse>(url, this.session.headers());
  }

  async loadout(): Promise<RiotLoadoutResponse> {
    const url = `${this.session.endpoints.pd}/personalization/v3/players/${this.session.puuid}/playerloadout`;
    return this.gateway.get<RiotLoadoutResponse>(url, this.session.headers());
  }

  async wallet(): Promise<RiotWalletResponse> {
    const url = `${this.session.endpoints.pd}/store/v1/wallet/${this.session.puuid}`;
    return this.gateway.get<RiotWalletResponse>(url, this.session.headers());
  }

  async names(puuids: string[]): Promise<RiotNameResponse[]> {
    const url = `${this.session.endpoints.pd}/name-service/v2/players`;
    return this.gateway.put<RiotNameResponse[]>(url, puuids, this.session.headers());
  }
}
