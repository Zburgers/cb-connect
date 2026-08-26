export const CYCLE_STATE_COPY_APPROVAL = "unapproved" as const;
export const CYCLE_STATE_COPY_EXPOSURE = "staff_only" as const;

export type CopyApprovalStatus = "unapproved" | "approved";
export type CycleStateCopyExposure = "staff_only" | "ordinary_users";
export type CopyAudience = "staff" | "ordinary_user";
export type ExplicitUserReport = {
  source: "user_report";
  text: string;
};

export type CycleStateCopyKey =
  | "recorded"
  | "calendarEstimate"
  | "late"
  | "unknown"
  | "paused"
  | "estimatedOvulationDisclaimer"
  | "genericCheckIn";

export type CycleStateCopyState =
  | "recorded"
  | "calendar_estimate"
  | "late"
  | "unknown"
  | "paused";

type CopyEntry = {
  label: string;
  title: string;
  text: string;
};

export const CYCLE_STATE_COPY_KEYS = [
  "recorded",
  "calendarEstimate",
  "late",
  "unknown",
  "paused",
  "estimatedOvulationDisclaimer",
  "genericCheckIn",
] as const satisfies readonly CycleStateCopyKey[];

export const cycleStateCopy: Record<CycleStateCopyKey, CopyEntry> = {
  recorded: {
    label: "Recorded",
    title: "Support from your report",
    text: "This support is based on what you reported.",
  },
  calendarEstimate: {
    label: "Calendar estimate",
    title: "A calendar estimate",
    text: "Use this as a planning cue, not a biological conclusion.",
  },
  late: {
    label: "Timing uncertain",
    title: "Check in with yourself",
    text: "The calendar estimate has passed; your current experience matters most.",
  },
  unknown: {
    label: "Not enough information",
    title: "Check in with yourself",
    text: "There is not enough information for a phase estimate.",
  },
  paused: {
    label: "Prediction paused",
    title: "Check in with yourself",
    text: "Calendar estimates are paused until you choose to resume them.",
  },
  estimatedOvulationDisclaimer: {
    label: "Estimate disclaimer",
    title: "About this estimate",
    text: "Calendar timing is an estimate and does not confirm ovulation.",
  },
  genericCheckIn: {
    label: "Check in",
    title: "What feels supportive today?",
    text: "Notice what you are experiencing and choose support that feels appropriate.",
  },
};

export function getCycleStateCopy(key: CycleStateCopyKey): CopyEntry {
  return cycleStateCopy[key];
}

export function getSupportCopy({
  state,
  explicitReport,
}: {
  state: CycleStateCopyState;
  explicitReport?: ExplicitUserReport | null;
}): { key: CycleStateCopyKey; copy: CopyEntry } {
  if (isExplicitUserReport(explicitReport)) {
    return { key: "recorded", copy: cycleStateCopy.recorded };
  }

  const keyByState: Record<CycleStateCopyState, CycleStateCopyKey> = {
    recorded: "recorded",
    calendar_estimate: "calendarEstimate",
    late: "late",
    unknown: "unknown",
    paused: "paused",
  };
  const key = keyByState[state];
  return { key, copy: cycleStateCopy[key] };
}

export function getPublicSupportCopy({
  state,
  explicitReport,
}: {
  state: CycleStateCopyState;
  explicitReport?: ExplicitUserReport | null;
}): { key: CycleStateCopyKey; copy: CopyEntry } {
  if (isExplicitUserReport(explicitReport)) {
    return getSupportCopy({ state, explicitReport });
  }

  if (!canExposeCycleStateCopy("ordinary_user")) {
    return { key: "genericCheckIn", copy: cycleStateCopy.genericCheckIn };
  }

  return getSupportCopy({ state });
}

function isExplicitUserReport(
  value: ExplicitUserReport | null | undefined
): value is ExplicitUserReport {
  return (
    typeof value === "object" &&
    value !== null &&
    value.source === "user_report" &&
    typeof value.text === "string" &&
    value.text.trim().length > 0
  );
}

export function canExposeCycleStateCopy(
  audience: CopyAudience,
  approval: CopyApprovalStatus = CYCLE_STATE_COPY_APPROVAL,
  exposure: CycleStateCopyExposure = CYCLE_STATE_COPY_EXPOSURE
): boolean {
  if (audience === "staff") return true;
  return audience === "ordinary_user" && exposure === "ordinary_users" && approval === "approved";
}
