import type { Doc } from "../_generated/dataModel";
import { isCycleFactsV1Enabled } from "./cycleFactsFlag";
import { isCycleStateV1Enabled } from "./cycleStateFlag";

/** Keep the unapproved state payload inside the existing fixture/test audience. */
export function isCycleStateV1ExposedToUser(
  viewer: Pick<Doc<"users">, "fixtureRunId">,
  target: Pick<Doc<"users">, "fixtureRunId"> = viewer,
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return (
    isCycleFactsV1Enabled(environment) &&
    isCycleStateV1Enabled(environment) &&
    typeof viewer.fixtureRunId === "string" &&
    viewer.fixtureRunId.length > 0 &&
    viewer.fixtureRunId === target.fixtureRunId
  );
}
