const CYCLE_FACTS_FLAG_NAME = "CB_CONNECT_CYCLE_FACTS_V1";

export function isCycleFactsV1Enabled(
  environment: Record<string, string | undefined> = process.env
): boolean {
  return environment[CYCLE_FACTS_FLAG_NAME] === "true";
}
