import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dateDaysAgo, localDate, loggingErrorMessage, periodSuccessMessage } from "./logging";

const source = readFileSync(new URL("./LoggingScreen.tsx", import.meta.url), "utf8");

describe("mobile logging safety", () => {
  it("renders backend duplicate, overlap, future and stale-authority failures as safe guidance", () => {
    for (const code of ["DUPLICATE_EXACT_START", "EXACT_INTERVAL_OVERLAP", "PERIOD_HISTORY_TOO_DENSE"]) {
      expect(loggingErrorMessage(new Error(`${code}: private date 2026-01-01`))).toContain("overlaps");
      expect(loggingErrorMessage(new Error(`${code}: private date 2026-01-01`))).not.toContain("2026-01-01");
    }
    expect(loggingErrorMessage(new Error("PERIOD_START_FUTURE"))).toContain("today or an earlier date");
    expect(loggingErrorMessage(new Error("STALE_AUTHORITY_VERSION"))).toContain("changed");
    expect(loggingErrorMessage(new Error("FUTURE_DATE"))).toContain("today or an earlier date");
  });

  it("leaves write authorization and correction eligibility with Convex", () => {
    expect(source).toContain("loggingApi.periods.logPeriodStart");
    expect(source).toContain("loggingApi.periods.assistLogPeriodStart");
    expect(source).toContain("loggingApi.periods.updatePeriodEvent");
    expect(source).toContain("!period.canCorrect");
    expect(source).toContain("period.canCorrect && period._id");
    expect(source).not.toContain("deletePeriodEvent");
  });

  it("reports offline writes truthfully and labels controls for assistive technology", () => {
    expect(source).toContain("if (!online) throw new Error(\"offline\")");
    expect(source).toContain("Nothing can be saved until your connection returns.");
    expect(source).toContain("accessibilityRole=\"button\"");
    expect(source).toContain("accessibilityLabel={openPeriod ? \"Period end date");
    expect(source).toContain("accessibilityRole=\"alert\"");
  });

  it("uses device-local calendar dates without serializing private notes into history UI", () => {
    const now = new Date(2026, 9, 26, 23, 30);
    expect(localDate(now)).toBe("2026-10-26");
    expect(dateDaysAgo(1, now)).toBe("2026-10-25");
    expect(source).not.toContain("pain.note");
    expect(source).not.toContain("timeZone");
  });

  it("confirms the action that actually completed and reports partial starts and stale corrections", () => {
    expect(periodSuccessMessage(true, false)).toBe("Period end confirmed.");
    expect(periodSuccessMessage(false, false)).toBe("Period start saved as open.");
    expect(periodSuccessMessage(false, true)).toBe("Period start and end saved.");
    expect(loggingErrorMessage(new Error("START_SAVED_END_FAILED"))).toContain("saved as open");
    expect(loggingErrorMessage(new Error("STALE_AUTHORITY_VERSION"))).toContain("Refresh history");
  });
});
