import { createHmac } from "node:crypto";

export const CYCLE_BENCHMARK_PROTOCOL_VERSION = "G3-BENCH-V1" as const;
export const CYCLE_BENCHMARK_SPLIT_VERSION =
  "hmac-sha256-60-20-20-v1" as const;

const ALLOWED_BENCHMARK_FIELDS = new Set([
  "userKey",
  "timezone",
  "configuredCycleLength",
  "eventKey",
  "startDate",
  "startCertainty",
  "legacyReason",
  "tombstoneAt",
  "source",
  "confirmationStatus",
  "authorityVersion",
  "primaryCorrectionVersion",
  "createdAt",
  "updatedAt",
  "segmentKey",
  "status",
  "supersededAt",
]);
const REQUIRED_BENCHMARK_FIELDS = [
  "userKey",
  "timezone",
  "configuredCycleLength",
  "eventKey",
  "startDate",
  "startCertainty",
  "createdAt",
  "updatedAt",
] as const;

export type CycleBenchmarkPartition =
  | "development"
  | "calibration"
  | "evaluation";

export type CycleBenchmarkManifest = {
  manifestId: string;
  protocolVersion: typeof CYCLE_BENCHMARK_PROTOCOL_VERSION;
  datasetClass: "synthetic" | "external_academic" | "cb_connect";
  datasetSha256: string;
  split: {
    version: typeof CYCLE_BENCHMARK_SPLIT_VERSION;
    saltId: string;
    allocation: {
      development: 60;
      calibration: 20;
      evaluation: 20;
    };
  };
  synthetic?: {
    fixtureId: "g3-bench-golden-v1";
    containsRealUserData: false;
  };
  source?: {
    sourceId: string;
    version: string;
    licenseOrPermission: string;
    permittedPurpose: string;
    cohort: string;
    inclusionExclusionRules: string;
    deidentificationStatus: "confirmed";
    fieldsUsed: string[];
    userCount: number;
    outcomeCount: number;
    missingnessAndAdherence: string;
    transferLimitations: string;
  };
  authority?: {
    decisionId: "D-013";
    status: "approved";
    authorityReference: string;
    permissionOrConsentBasis: string;
    approvedBy: string;
    approvedAt: string;
    preregistrationApprover: string;
    preregistrationApprovedAt: string;
    evaluationHoldout?: {
      state: "locked" | "opened_once";
      openedBy?: string;
      openedAt?: string;
    };
  };
  developmentCutoffs?: {
    variabilityMadQ33: number;
    variabilityMadQ67: number;
    medianIntervalQ33: number;
    medianIntervalQ67: number;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isUtcTimestamp = (value: unknown): value is string => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) {
    return false;
  }
  const time = Date.parse(value);
  const normalized = value.includes(".")
    ? value.replace(/\.(\d{1,3})Z$/, (_, fraction: string) =>
        `.${fraction.padEnd(3, "0")}Z`,
      )
    : value.replace(/Z$/, ".000Z");
  return (
    Number.isFinite(time) &&
    new Date(time).toISOString() === normalized
  );
};

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function requireManifest(value: unknown): asserts value is CycleBenchmarkManifest {
  if (!isRecord(value)) throw new Error("Dataset manifest is missing or invalid");
  const manifest = value;
  if (
    !hasOnlyKeys(manifest, [
      "manifestId",
      "protocolVersion",
      "datasetClass",
      "datasetSha256",
      "split",
      "synthetic",
      "source",
      "authority",
      "developmentCutoffs",
    ]) ||
    !isNonEmptyString(manifest.manifestId) ||
    manifest.protocolVersion !== CYCLE_BENCHMARK_PROTOCOL_VERSION ||
    typeof manifest.datasetSha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(manifest.datasetSha256) ||
    !isRecord(manifest.split) ||
    !hasOnlyKeys(manifest.split, ["version", "saltId", "allocation"]) ||
    manifest.split.version !== CYCLE_BENCHMARK_SPLIT_VERSION ||
    !isNonEmptyString(manifest.split.saltId) ||
    !isRecord(manifest.split.allocation) ||
    !hasOnlyKeys(manifest.split.allocation, [
      "development",
      "calibration",
      "evaluation",
    ]) ||
    manifest.split.allocation.development !== 60 ||
    manifest.split.allocation.calibration !== 20 ||
    manifest.split.allocation.evaluation !== 20
  ) {
    throw new Error("Dataset manifest does not match G3-BENCH-V1");
  }

  if (manifest.datasetClass === "synthetic") {
    if (
      manifest.source !== undefined ||
      manifest.authority !== undefined ||
      manifest.developmentCutoffs !== undefined ||
      (manifest.synthetic !== undefined &&
        (!isRecord(manifest.synthetic) ||
          !hasOnlyKeys(manifest.synthetic, [
            "fixtureId",
            "containsRealUserData",
          ])))
    ) {
      throw new Error("Synthetic dataset manifest contains unapproved metadata");
    }
    return;
  }
  if (
    manifest.datasetClass !== "external_academic" &&
    manifest.datasetClass !== "cb_connect"
  ) {
    throw new Error("Dataset source class is unknown");
  }

  const source = manifest.source;
  const authority = manifest.authority;
  const sourceFieldsUsed = isRecord(source) ? source.fieldsUsed : undefined;
  if (
    !isRecord(source) ||
    !hasOnlyKeys(source, [
      "sourceId",
      "version",
      "licenseOrPermission",
      "permittedPurpose",
      "cohort",
      "inclusionExclusionRules",
      "deidentificationStatus",
      "fieldsUsed",
      "userCount",
      "outcomeCount",
      "missingnessAndAdherence",
      "transferLimitations",
    ]) ||
    !isNonEmptyString(source.sourceId) ||
    !isNonEmptyString(source.version) ||
    !isNonEmptyString(source.licenseOrPermission) ||
    !isNonEmptyString(source.permittedPurpose) ||
    !isNonEmptyString(source.cohort) ||
    !isNonEmptyString(source.inclusionExclusionRules) ||
    source.deidentificationStatus !== "confirmed" ||
    !Array.isArray(sourceFieldsUsed) ||
    sourceFieldsUsed.length === 0 ||
    new Set(sourceFieldsUsed).size !== sourceFieldsUsed.length ||
    !sourceFieldsUsed.every(
      (field) =>
        isNonEmptyString(field) && ALLOWED_BENCHMARK_FIELDS.has(field),
    ) ||
    !REQUIRED_BENCHMARK_FIELDS.every((field) =>
      sourceFieldsUsed.includes(field),
    ) ||
    !Number.isSafeInteger(source.userCount) ||
    (source.userCount as number) < 1 ||
    !Number.isSafeInteger(source.outcomeCount) ||
    (source.outcomeCount as number) < 1 ||
    !isNonEmptyString(source.missingnessAndAdherence) ||
    !isNonEmptyString(source.transferLimitations) ||
    !isRecord(authority) ||
    !hasOnlyKeys(authority, [
      "decisionId",
      "status",
      "authorityReference",
      "permissionOrConsentBasis",
      "approvedBy",
      "approvedAt",
      "preregistrationApprover",
      "preregistrationApprovedAt",
      "evaluationHoldout",
    ]) ||
    authority.decisionId !== "D-013" ||
    authority.status !== "approved" ||
    !isNonEmptyString(authority.authorityReference) ||
    !isNonEmptyString(authority.permissionOrConsentBasis) ||
    !isNonEmptyString(authority.approvedBy) ||
    !isUtcTimestamp(authority.approvedAt) ||
    !isNonEmptyString(authority.preregistrationApprover) ||
    !isUtcTimestamp(authority.preregistrationApprovedAt)
  ) {
    throw new Error("D-013 dataset authority manifest is incomplete or unapproved");
  }

  if (authority.evaluationHoldout !== undefined) {
    const holdout = authority.evaluationHoldout;
    if (
      !isRecord(holdout) ||
      !hasOnlyKeys(holdout, ["state", "openedBy", "openedAt"]) ||
      (holdout.state !== "locked" && holdout.state !== "opened_once") ||
      (holdout.state === "locked" &&
        (holdout.openedBy !== undefined || holdout.openedAt !== undefined)) ||
      (holdout.state === "opened_once" &&
        (!isNonEmptyString(holdout.openedBy) ||
          !isUtcTimestamp(holdout.openedAt)))
    ) {
      throw new Error("D-013 evaluation holdout metadata is invalid");
    }
  }

  if (manifest.developmentCutoffs !== undefined) {
    const cutoffs = manifest.developmentCutoffs;
    if (
      !isRecord(cutoffs) ||
      !hasOnlyKeys(cutoffs, [
        "variabilityMadQ33",
        "variabilityMadQ67",
        "medianIntervalQ33",
        "medianIntervalQ67",
      ]) ||
      ![
        cutoffs.variabilityMadQ33,
        cutoffs.variabilityMadQ67,
        cutoffs.medianIntervalQ33,
        cutoffs.medianIntervalQ67,
      ].every((cutoff) => typeof cutoff === "number" && Number.isFinite(cutoff)) ||
      (cutoffs.variabilityMadQ33 as number) < 0 ||
      (cutoffs.variabilityMadQ67 as number) < 0 ||
      (cutoffs.medianIntervalQ33 as number) < 0 ||
      (cutoffs.medianIntervalQ67 as number) < 0 ||
      (cutoffs.variabilityMadQ33 as number) >
        (cutoffs.variabilityMadQ67 as number) ||
      (cutoffs.medianIntervalQ33 as number) >
        (cutoffs.medianIntervalQ67 as number)
    ) {
      throw new Error("Development cutoffs are invalid");
    }
  }
}

export function validateCycleBenchmarkManifest(
  value: unknown,
  partition: CycleBenchmarkPartition,
  isCheckedInGoldenFixture = false,
): asserts value is CycleBenchmarkManifest {
  requireManifest(value);

  if (value.datasetClass === "synthetic") {
    if (
      !isCheckedInGoldenFixture ||
      partition !== "development" ||
      !isRecord(value.synthetic) ||
      !hasOnlyKeys(value.synthetic, ["fixtureId", "containsRealUserData"]) ||
      value.synthetic.fixtureId !== "g3-bench-golden-v1" ||
      value.synthetic.containsRealUserData !== false
    ) {
      throw new Error(
        "Synthetic datasets are limited to the checked-in development fixture",
      );
    }
    return;
  }

  if (partition !== "development" && value.developmentCutoffs === undefined) {
    throw new Error("Calibration and evaluation require frozen development cutoffs");
  }
  if (partition === "evaluation") {
    const authority = value.authority;
    const holdout = authority?.evaluationHoldout;
    if (
      holdout?.state !== "opened_once" ||
      !isNonEmptyString(holdout.openedBy) ||
      !isUtcTimestamp(holdout.openedAt)
    ) {
      throw new Error("D-013 locked evaluation holdout is not approved to open");
    }
    const openedAt = Date.parse(holdout.openedAt);
    const latestApprovalAt = Math.max(
      Date.parse(authority!.approvedAt),
      Date.parse(authority!.preregistrationApprovedAt),
    );
    if (
      openedAt <= latestApprovalAt
    ) {
      throw new Error(
        "D-013 evaluation holdout must open strictly after authority and preregistration approval",
      );
    }
  }
}

export function assignCycleBenchmarkPartition(
  pseudonymousUserKey: string,
  salt: string,
): CycleBenchmarkPartition {
  if (!isNonEmptyString(pseudonymousUserKey) || salt.length < 16) {
    throw new Error("Stable pseudonymous key and benchmark split salt are required");
  }
  const digest = createHmac("sha256", salt)
    .update(pseudonymousUserKey, "utf8")
    .digest("hex");
  const bucket = Math.floor(
    (Number.parseInt(digest.slice(0, 13), 16) / 2 ** 52) * 10000,
  );
  if (bucket < 6000) return "development";
  return bucket < 8000 ? "calibration" : "evaluation";
}
