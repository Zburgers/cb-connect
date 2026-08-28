import type { Page } from "@playwright/test";
import type { ConvexHttpClient } from "convex/browser";

import { api } from "../../convex/_generated/api";
import { APPROVED_CONVEX_DEPLOYMENT } from "./authEnvironment";

export type ExpectedCycleStateMode = "enabled" | "disabled";
export type BackendIdentityStatus = "approved" | "unexpected" | "unavailable";
export type CompatibilityStatus = "expected" | "unexpected" | "unavailable";
export type DirectBoolean = boolean | "unavailable";
export type SemanticPresence = "present" | "null" | "unavailable";
export type CycleStateStatus =
  | "recorded_period"
  | "estimated"
  | "late_or_uncertain"
  | "insufficient_data"
  | "prediction_paused"
  | null
  | "unavailable";

export type ReleaseDiagnostics = {
  expectedMode: ExpectedCycleStateMode;
  backendIdentity: {
    deployment: BackendIdentityStatus;
    compatibility: CompatibilityStatus;
  };
  capabilities: {
    cycleFactsV1: DirectBoolean;
    cycleStateV1: DirectBoolean;
  };
  dashboard: {
    hasData: DirectBoolean;
    cycleInfo: SemanticPresence;
    cycleStateV1: CycleStateStatus;
    cycleStateV1Exposed: DirectBoolean;
  };
  dom: {
    cycleStateV1: "enabled" | "disabled" | "missing";
    cycleStateMarkerCount: number;
    semanticStateMarkerCount: number;
    phaseAuraCard: "present" | "absent";
  };
};

const EXPECTED_BACKEND_COMPATIBILITY = "v1";

function cycleStateStatus(value: unknown): CycleStateStatus {
  if (value === null) return null;
  if (typeof value !== "object" || value === null) return "unavailable";
  const status = (value as { status?: unknown }).status;
  if (
    status === "recorded_period" ||
    status === "estimated" ||
    status === "late_or_uncertain" ||
    status === "insufficient_data" ||
    status === "prediction_paused"
  ) {
    return status;
  }
  return "unavailable";
}

function booleanValue(value: unknown): DirectBoolean {
  return typeof value === "boolean" ? value : "unavailable";
}

function presenceValue(value: unknown): SemanticPresence {
  if (value === null) return "null";
  return value === undefined ? "unavailable" : "present";
}

export async function collectReleaseDiagnostics(
  page: Page,
  client: ConvexHttpClient,
  expectedMode: ExpectedCycleStateMode,
): Promise<ReleaseDiagnostics> {
  let capabilities: ReleaseDiagnostics["capabilities"] = {
    cycleFactsV1: "unavailable",
    cycleStateV1: "unavailable",
  };
  let dashboard: ReleaseDiagnostics["dashboard"] = {
    hasData: "unavailable",
    cycleInfo: "unavailable",
    cycleStateV1: "unavailable",
    cycleStateV1Exposed: "unavailable",
  };
  let backendIdentity: ReleaseDiagnostics["backendIdentity"] = {
    deployment: "unavailable",
    compatibility: "unavailable",
  };

  try {
    const result = await client.query(
      api.queries.system.getBackendIdentity,
      {},
    );
    if (result !== null) {
      backendIdentity = {
        deployment:
          result.deployment === APPROVED_CONVEX_DEPLOYMENT
            ? "approved"
            : "unexpected",
        compatibility:
          result.compatibilityVersion === EXPECTED_BACKEND_COMPATIBILITY
            ? "expected"
            : "unexpected",
      };
    }
  } catch {
    // Keep the sanitized unavailable markers; the caller asserts them below.
  }

  try {
    const result = await client.query(
      api.queries.capabilities.getCapabilities,
      {},
    );
    capabilities = {
      cycleFactsV1: booleanValue(result.cycleFactsV1),
      cycleStateV1: booleanValue(result.cycleStateV1),
    };
  } catch {
    // Keep the sanitized unavailable marker; the caller asserts it below.
  }

  try {
    const result = await client.query(
      api.queries.dashboard.getDashboardData,
      {},
    );
    dashboard = {
      hasData: booleanValue(result.hasData),
      cycleInfo: presenceValue(result.cycleInfo),
      cycleStateV1: cycleStateStatus(result.cycleStateV1),
      cycleStateV1Exposed: booleanValue(result.cycleStateV1Exposed),
    };
  } catch {
    // Keep the sanitized unavailable marker; the caller asserts it below.
  }

  const cycleStateMarker = page.locator(
    'main[data-cycle-state-v1="enabled"], main[data-cycle-state-v1="disabled"]',
  );
  const cycleStateMarkerCount = await cycleStateMarker.count();
  const semanticStateMarkerCount = await page
    .locator("[data-cycle-state]")
    .count();
  const cycleStateV1 =
    cycleStateMarkerCount === 1
      ? (((await cycleStateMarker.getAttribute("data-cycle-state-v1")) as
          | "enabled"
          | "disabled"
          | null) ?? "missing")
      : "missing";

  return {
    expectedMode,
    backendIdentity,
    capabilities,
    dashboard,
    dom: {
      cycleStateV1,
      cycleStateMarkerCount,
      semanticStateMarkerCount,
      phaseAuraCard:
        (await page.locator(".phase-aura-card").count()) > 0
          ? "present"
          : "absent",
    },
  };
}
