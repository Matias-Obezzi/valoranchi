import type {
  AssessmentWarning,
  Mmr,
  PlayerAssessment,
} from "../model/index.js";
import type { RiotCompetitiveUpdate } from "../riot/types.js";
import { calculateStreak } from "./ratingTrend.js";

export interface PlayerAssessmentInput {
  puuid: string;
  accountLevel: number | null;
  mmr: Mmr | null;
  updates: RiotCompetitiveUpdate[];
}

export function playerAssessment(input: PlayerAssessmentInput): PlayerAssessment {
  const flags: AssessmentWarning[] = [];
  const tier = input.mmr?.current?.tier ?? 0;
  const level = input.accountLevel ?? 0;

  if (
    input.accountLevel !== null &&
    input.accountLevel !== undefined &&
    input.accountLevel < 50 &&
    tier >= 15
  ) {
    flags.push({
      flag: "low-level-high-rank",
      reason: `Account level ${level} under 50 with Platinum or higher rank (tier ${tier})`,
    });
  }

  if (input.mmr?.fit?.verdict === "above") {
    flags.push({
      flag: "inflated",
      reason: "Rank fit indicates account is above its expected rank",
    });
  }

  if (input.mmr?.fit?.verdict === "below" && input.mmr.fit.ranksAbove === 2) {
    flags.push({
      flag: "underranked",
      reason: "Rank fit indicates account is two ranks below its expected rank",
    });
  }

  const streak = calculateStreak(input.updates);
  if (streak.kind && streak.length >= 5) {
    flags.push({
      flag: "long-streak",
      reason: `${streak.length}-game ${streak.kind} streak`,
    });
  }

  if (input.mmr?.act && input.mmr.act.games < 5) {
    flags.push({
      flag: "new-act",
      reason: `Fewer than 5 competitive games played this act (${input.mmr.act.games})`,
    });
  }

  return {
    puuid: input.puuid,
    accountLevel: level,
    flags,
    warnings: flags.map((f) => f.flag),
  };
}
