"use client";

import {
  type UseQueryResult,
  useQuery_experimental,
} from "convex/react";

import { api } from "../convex/_generated/api";

export type CycleFactsCapability = {
  cycleFactsV1: boolean;
  cycleStateV1?: boolean;
};

export function readCycleFactsCapability(
  result: UseQueryResult<CycleFactsCapability>,
): CycleFactsCapability | undefined {
  return result.status === "success" ? result.data : undefined;
}

export function useCycleFactsCapability(
  shouldQuery: boolean,
): CycleFactsCapability | undefined {
  const result = useQuery_experimental({
    query: api.queries.capabilities.getCapabilities,
    args: shouldQuery ? {} : "skip",
    throwOnError: false,
  });

  return readCycleFactsCapability(result);
}
