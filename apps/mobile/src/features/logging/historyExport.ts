type ExportPeriod = {
  startDate: string;
  endDate?: string;
  source: string;
  createdByName: string;
  updatedByName: string;
};

type ExportTimelineEntry = {
  date: string;
  type: "period" | "pain";
  pain?: { score: number; tags?: readonly string[]; note?: string };
};

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildHistoryCsv({
  periods,
  timeline,
  isPartner,
}: {
  periods: readonly ExportPeriod[];
  timeline: readonly ExportTimelineEntry[];
  isPartner: boolean;
}): string {
  const rows: unknown[][] = [
    ["section", "date", "endDate", "painScore", "tags", "note", "status", "source", "createdBy", "updatedBy"],
    ...periods.map((period) => [
      "period",
      period.startDate,
      period.endDate ?? "",
      "",
      "",
      "",
      period.endDate ? "closed" : "open",
      period.source,
      period.createdByName,
      period.updatedByName,
    ]),
    ...timeline.filter((entry) => entry.type === "pain" && entry.pain).map((entry) => [
      "pain",
      entry.date,
      "",
      entry.pain!.score,
      entry.pain!.tags?.join("; ") ?? "",
      isPartner ? "" : entry.pain!.note ?? "",
      "",
      "",
      "",
      "",
    ]),
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function historyCsvFilename(today: string): string {
  return `cb-connect-history-${today}.csv`;
}
