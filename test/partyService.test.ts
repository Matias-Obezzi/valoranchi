import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import type { ClientContext } from "../src/client/ClientContext.js";
import { PartyService } from "../src/client/PartyService.js";
import { ValidationError } from "../src/errors.js";
import type { HttpGateway } from "../src/riot/HttpGateway.js";
import { RiotApi } from "../src/riot/RiotApi.js";
import { Session } from "../src/riot/Session.js";
import type { RiotPartyResponse } from "../src/riot/types.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

function makeRawParty(overrides?: Partial<RiotPartyResponse>): RiotPartyResponse {
  return {
    ID: "party-1",
    State: "DEFAULT",
    Accessibility: "CLOSED",
    MatchmakingData: { QueueID: "competitive" },
    EligibleQueues: ["competitive", "unrated"],
    QueueIneligibilities: [],
    InviteCode: "CODE123",
    RestrictedSeconds: 0,
    Members: [
      { Subject: "self-puuid", IsOwner: true, IsReady: true },
      { Subject: "other-puuid", IsOwner: false, IsReady: true },
    ],
    ...overrides,
  };
}

describe("PartyService", () => {
  let mockGet: ReturnType<typeof vi.fn>;
  let mockPost: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;
  let fakeGateway: HttpGateway;
  let session: Session;
  let rawParty: RiotPartyResponse;
  let service: PartyService;

  beforeEach(() => {
    rawParty = makeRawParty();
    session = new Session({
      puuid: "self-puuid",
      accessToken: "token",
      entitlementsToken: "jwt",
      region: "latam",
      shard: "na",
      clientVersion: "release-1.0",
    });

    mockGet = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/parties/v1/players/")) {
        return { Subject: "self-puuid", CurrentPartyID: "party-1" };
      }
      if (url.includes("/parties/v1/parties/")) {
        return rawParty;
      }
      return {};
    });
    mockPost = vi.fn().mockResolvedValue({});
    mockDelete = vi.fn().mockResolvedValue(undefined);

    fakeGateway = {
      get: mockGet,
      post: mockPost,
      delete: mockDelete,
      getOrNull: mockGet,
    } as unknown as HttpGateway;

    const apiInstance = new RiotApi(fakeGateway, session);
    const catalogue = new Catalogue(catalogueData);

    const context: ClientContext = {
      language: "en-US",
      sessions: {
        session: async () => session,
      } as never,
      valorantApi: {} as never,
      api: () => apiInstance,
      catalogue: async () => catalogue,
      player: () => ({} as never),
    };

    service = new PartyService(context);
  });

  it("reads party and builds party model", async () => {
    const party = await service.current();
    expect(party).not.toBeNull();
    expect(party?.id).toBe("party-1");
    expect(party?.accessibility).toBe("closed");
    expect(party?.queue).toBe("competitive");
    expect(party?.members).toHaveLength(2);
  });

  describe("happy path write requests", () => {
    it("invites player to party", async () => {
      await service.invite("Jett#1234");
      expect(mockPost).toHaveBeenCalledWith(
        "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/party-1/invites/name/Jett/tag/1234",
        undefined,
        expect.any(Object),
      );
    });

    it("kicks member from party", async () => {
      await service.kick("other-puuid");
      expect(mockDelete).toHaveBeenCalledWith(
        "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/party-1/members/other-puuid",
        expect.any(Object),
      );
    });

    it("promotes member to party owner", async () => {
      await service.promote("other-puuid");
      expect(mockPost).toHaveBeenCalledWith(
        "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/party-1/members/other-puuid/owner",
        undefined,
        expect.any(Object),
      );
    });

    it("generates invite code", async () => {
      await service.createInviteCode();
      expect(mockPost).toHaveBeenCalledWith(
        "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/party-1/invitecode",
        undefined,
        expect.any(Object),
      );
    });

    it("revokes invite code", async () => {
      await service.revokeInviteCode();
      expect(mockDelete).toHaveBeenCalledWith(
        "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/party-1/invitecode",
        expect.any(Object),
      );
    });

    it("joins party by code", async () => {
      await service.joinByCode("JOIN123");
      expect(mockPost).toHaveBeenCalledWith(
        "https://glz-latam-1.na.a.pvp.net/parties/v1/players/joinbycode/JOIN123",
        undefined,
        expect.any(Object),
      );
    });

    it("sets ready status", async () => {
      await service.setReady(true);
      expect(mockPost).toHaveBeenCalledWith(
        "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/party-1/members/self-puuid/setReady",
        { ready: true },
        expect.any(Object),
      );
    });

    it("sets queue", async () => {
      await service.setQueue("unrated");
      expect(mockPost).toHaveBeenCalledWith(
        "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/party-1/queue",
        { queueID: "unrated" },
        expect.any(Object),
      );
    });

    it("sets accessibility", async () => {
      await service.setAccessibility("open");
      expect(mockPost).toHaveBeenCalledWith(
        "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/party-1/accessibility",
        { accessibility: "OPEN" },
        expect.any(Object),
      );
    });

    it("starts matchmaking", async () => {
      await service.startMatchmaking();
      expect(mockPost).toHaveBeenCalledWith(
        "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/party-1/matchmaking/join",
        undefined,
        expect.any(Object),
      );
    });

    it("stops matchmaking", async () => {
      rawParty.State = "MATCHMAKING";
      await service.stopMatchmaking();
      expect(mockPost).toHaveBeenCalledWith(
        "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/party-1/matchmaking/leave",
        undefined,
        expect.any(Object),
      );
    });

    it("leaves party", async () => {
      await service.leave();
      expect(mockDelete).toHaveBeenCalledWith(
        "https://glz-latam-1.na.a.pvp.net/parties/v1/players/self-puuid",
        expect.any(Object),
      );
    });
  });

  describe("refused actions send nothing", () => {
    it("refuses invite with invalid riot id without sending", async () => {
      await expect(service.invite("invalid-id")).rejects.toThrow(ValidationError);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it("refuses kick of self without sending", async () => {
      await expect(service.kick("self-puuid")).rejects.toThrow(ValidationError);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("refuses promote when caller is not owner without sending", async () => {
      rawParty.Members[0]!.IsOwner = false;
      await expect(service.promote("other-puuid")).rejects.toThrow(ValidationError);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it("refuses queue change to ineligible queue without sending", async () => {
      await expect(service.setQueue("deathmatch")).rejects.toThrow(ValidationError);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it("refuses matchmaking join when members not ready without sending", async () => {
      rawParty.Members[1]!.IsReady = false;
      await expect(service.startMatchmaking()).rejects.toThrow(ValidationError);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it("refuses revoke invite code when code is missing without sending", async () => {
      rawParty.InviteCode = null;
      await expect(service.revokeInviteCode()).rejects.toThrow(ValidationError);
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
