const CYCLE_STATE_FLAG_NAME = "CB_CONNECT_CYCLE_STATE_V1";

export function isCycleStateV1Enabled(
  environment: Record<string, string | undefined> = process.env
): boolean {
  return environment[CYCLE_STATE_FLAG_NAME] === "true";
}
