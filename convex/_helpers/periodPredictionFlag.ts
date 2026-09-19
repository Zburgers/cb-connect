const PERIOD_PREDICTION_V2_FLAG = "CB_CONNECT_PERIOD_PREDICTION_V2";
const PARTNER_PREDICTION_V2_FLAG = "CB_CONNECT_PARTNER_PREDICTION_V2";

export function isPeriodPredictionV2Enabled(
  environment: Record<string, string | undefined> = process.env
): boolean {
  return environment[PERIOD_PREDICTION_V2_FLAG] === "true";
}

export function isPartnerPredictionV2Enabled(
  environment: Record<string, string | undefined> = process.env
): boolean {
  return environment[PARTNER_PREDICTION_V2_FLAG] === "true";
}
