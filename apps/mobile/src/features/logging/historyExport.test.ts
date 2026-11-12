import { describe, expect, it } from "vitest";
import { buildHistoryCsv } from "./historyExport";

describe("history CSV export", () => {
  it("matches web columns and escapes commas, quotes, and newlines", () => {
    const csv = buildHistoryCsv({
      periods: [{
        startDate: "2026-11-01",
        endDate: "2026-11-05",
        source: "partner_assist",
        createdByName: 'Sam, "S"',
        updatedByName: "Alex",
      }],
      timeline: [{
        date: "2026-11-03",
        type: "pain",
        pain: { score: 6, tags: ["cramps", "back"], note: "line one,\nline two" },
      }],
      isPartner: false,
    });

    expect(csv).toBe([
      '"section","date","endDate","painScore","tags","note","status","source","createdBy","updatedBy"',
      '"period","2026-11-01","2026-11-05","","","","closed","partner_assist","Sam, ""S""","Alex"',
      '"pain","2026-11-03","","6","cramps; back","line one,\nline two","","","",""',
    ].join("\n"));
  });

  it("omits pain notes from partner exports and excludes absent rows", () => {
    const csv = buildHistoryCsv({
      periods: [],
      timeline: [{
        date: "2026-11-03",
        type: "pain",
        pain: { score: 4, tags: [], note: "private detail" },
      }],
      isPartner: true,
    });

    expect(csv).not.toContain("private detail");
    expect(csv).toContain('"pain","2026-11-03","","4","","","","","",""');
    expect(csv.split("\n")).toHaveLength(2);
  });
});
