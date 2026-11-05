export interface RiskInputs {
  drawdown24h: number; // percentage points
  tradesLastHour: number;
  topPositionPct: number; // share of cost in the biggest position
  riskFlaggedToken: boolean;
}

/** 0-100 risk score. Same signals the CRE CopyGuard workflow uses, in one number for the UI and per-user pause lines. */
export function riskScore(i: RiskInputs): number {
  const dd = i.drawdown24h * 3.5;
  const burst = Math.max(0, i.tradesLastHour - 3) * 5;
  const conc = Math.max(0, i.topPositionPct - 70) * 0.6;
  const flagged = i.riskFlaggedToken ? 40 : 0;
  return Math.max(0, Math.min(100, Math.round(dd + burst + conc + flagged)));
}

export const riskWord = (s: number) => (s < 35 ? "Low" : s < 65 ? "Medium" : "High");
