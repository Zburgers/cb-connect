// @vitest-environment node
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  assignCycleBenchmarkPartition,
  CYCLE_BENCHMARK_PROTOCOL_VERSION,
  CYCLE_BENCHMARK_SPLIT_VERSION,
  validateCycleBenchmarkManifest,
  type CycleBenchmarkManifest,
} from "./cycle-benchmark-manifest";
import { loadCycleBenchmarkFiles } from "./cycle-benchmark";

const manifestHash = "a".repeat(64);
const tempDirectories: string[] = [];

function syntheticManifest(): CycleBenchmarkManifest {
  return {
    manifestId: "synthetic-test-v1",
    protocolVersion: CYCLE_BENCHMARK_PROTOCOL_VERSION,
    datasetClass: "synthetic",
    datasetSha256: manifestHash,
    split: {
      version: CYCLE_BENCHMARK_SPLIT_VERSION,
      saltId: "test-salt-v1",
      allocation: { development: 60, calibration: 20, evaluation: 20 },
    },
    synthetic: {
      fixtureId: "g3-bench-golden-v1",
      containsRealUserData: false,
    },
  };
}

function externalManifest(): CycleBenchmarkManifest {
  return {
    manifestId: "approved-external-test-v1",
    protocolVersion: CYCLE_BENCHMARK_PROTOCOL_VERSION,
    datasetClass: "external_academic",
    datasetSha256: manifestHash,
    split: {
      version: CYCLE_BENCHMARK_SPLIT_VERSION,
      saltId: "test-salt-v1",
      allocation: { development: 60, calibration: 20, evaluation: 20 },
    },
    source: {
      sourceId: "public-study-test",
      version: "1",
      licenseOrPermission: "test permission",
      permittedPurpose: "cycle timing benchmark",
      cohort: "synthetic test cohort",
      inclusionExclusionRules: "exact start dates only",
      deidentificationStatus: "confirmed",
      fieldsUsed: [
        "userKey",
        "timezone",
        "configuredCycleLength",
        "eventKey",
        "startDate",
        "startCertainty",
        "createdAt",
        "updatedAt",
      ],
      userCount: 10,
      outcomeCount: 100,
      missingnessAndAdherence: "recorded in source manifest",
      transferLimitations: "not population trained",
    },
    authority: {
      decisionId: "D-013",
      status: "approved",
      authorityReference: "approved-test-record",
      permissionOrConsentBasis: "approved test basis",
      approvedBy: "Named Reviewer",
      approvedAt: "2026-09-20T10:00:00Z",
      preregistrationApprover: "Named Statistician",
      preregistrationApprovedAt: "2026-09-20T10:05:00Z",
      evaluationHoldout: { state: "locked" },
    },
  };
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("cycle benchmark manifest", () => {
  test("assigns a stable user-level HMAC partition", () => {
    const salt = "benchmark-test-salt-v1-123456";
    expect(assignCycleBenchmarkPartition("alpha-user", salt)).toBe("development");
    expect(assignCycleBenchmarkPartition("alpha-user", salt)).toBe("development");
    expect(assignCycleBenchmarkPartition("gamma-user", salt)).toBe("calibration");
    expect(() => assignCycleBenchmarkPartition("alpha-user", "short")).toThrow(
      "split salt",
    );
  });

  test("limits synthetic manifests to the checked-in golden development fixture", () => {
    const manifest = syntheticManifest();
    expect(() =>
      validateCycleBenchmarkManifest(manifest, "development", true),
    ).not.toThrow();
    expect(() =>
      validateCycleBenchmarkManifest(manifest, "development", false),
    ).toThrow("checked-in development fixture");
    expect(() =>
      validateCycleBenchmarkManifest(manifest, "evaluation", true),
    ).toThrow("checked-in development fixture");
    expect(() =>
      validateCycleBenchmarkManifest(
        { ...manifest, source: externalManifest().source },
        "development",
        true,
      ),
    ).toThrow("unapproved metadata");
  });

  test("requires explicit D-013 source authority, cutoffs, and one-time holdout opening", () => {
    const manifest = externalManifest();
    expect(() =>
      validateCycleBenchmarkManifest(manifest, "development"),
    ).not.toThrow();
    expect(() =>
      validateCycleBenchmarkManifest(manifest, "calibration"),
    ).toThrow("frozen development cutoffs");
    expect(() =>
      validateCycleBenchmarkManifest(manifest, "evaluation"),
    ).toThrow("frozen development cutoffs");

    const frozen = {
      ...manifest,
      developmentCutoffs: {
        variabilityMadQ33: 1,
        variabilityMadQ67: 3,
        medianIntervalQ33: 27,
        medianIntervalQ67: 30,
      },
    };
    expect(() => validateCycleBenchmarkManifest(frozen, "calibration")).not.toThrow();
    expect(() => validateCycleBenchmarkManifest(frozen, "evaluation")).toThrow(
      "not approved to open",
    );
    expect(() =>
      validateCycleBenchmarkManifest(
        {
          ...frozen,
          authority: {
            ...frozen.authority,
            evaluationHoldout: {
              state: "opened_once",
              openedBy: "Named Holdout Reviewer",
              openedAt: "2026-09-20T11:00:00Z",
            },
          },
        },
        "evaluation",
      ),
    ).not.toThrow();

    expect(() =>
      validateCycleBenchmarkManifest(
        {
          ...frozen,
          authority: {
            ...frozen.authority,
            evaluationHoldout: {
              state: "opened_once",
              openedBy: "Named Holdout Reviewer",
              openedAt: "2026-09-20T10:04:00Z",
            },
          },
        },
        "evaluation",
      ),
    ).toThrow("open strictly after authority and preregistration approval");
  });

  test("records one evaluation opening before reading outcome bytes", () => {
    const directory = mkdtempSync(join(tmpdir(), "cycle-benchmark-evaluation-"));
    tempDirectories.push(directory);
    const datasetPath = join(directory, "outcomes.json");
    const dataBytes = Buffer.from("not-json");
    const manifest = externalManifest();
    manifest.datasetSha256 = createHash("sha256").update(dataBytes).digest("hex");
    manifest.developmentCutoffs = {
      variabilityMadQ33: 1,
      variabilityMadQ67: 3,
      medianIntervalQ33: 27,
      medianIntervalQ67: 30,
    };
    manifest.authority!.evaluationHoldout = {
      state: "opened_once",
      openedBy: "Named Holdout Reviewer",
      openedAt: "2026-09-20T11:00:00Z",
    };
    const manifestPath = join(directory, "manifest.json");
    const receiptDirectory = join(directory, "openings");
    writeFileSync(manifestPath, JSON.stringify(manifest));
    writeFileSync(datasetPath, dataBytes);
    const priorSalt = process.env.CYCLE_BENCHMARK_SPLIT_SALT;
    const priorSaltId = process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID;
    process.env.CYCLE_BENCHMARK_SPLIT_SALT = "0123456789abcdef";
    process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID = "test-salt-v1";
    const options = {
      datasetPath,
      manifestPath,
      partition: "evaluation" as const,
      isGoldenFixture: false,
      evaluationReceiptDirectory: receiptDirectory,
    };
    try {
      expect(() => loadCycleBenchmarkFiles(options)).toThrow(
        "Benchmark data file is not valid JSON",
      );
      const receipt = JSON.parse(
        readFileSync(
          join(receiptDirectory, `${manifest.datasetSha256}.json`),
          "utf8",
        ),
      );
      expect(receipt).toMatchObject({
        protocolVersion: CYCLE_BENCHMARK_PROTOCOL_VERSION,
        datasetSha256: manifest.datasetSha256,
      });
      expect(() => loadCycleBenchmarkFiles(options)).toThrow(
        "already been opened in this checkout",
      );
    } finally {
      if (priorSalt === undefined) delete process.env.CYCLE_BENCHMARK_SPLIT_SALT;
      else process.env.CYCLE_BENCHMARK_SPLIT_SALT = priorSalt;
      if (priorSaltId === undefined) delete process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID;
      else process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID = priorSaltId;
    }
  });

  test("rejects unknown source fields, unknown manifest keys, and unapproved authority", () => {
    const manifest = externalManifest();
    expect(() =>
      validateCycleBenchmarkManifest(
        {
          ...manifest,
          source: { ...manifest.source, fieldsUsed: ["userKey", "painScore"] },
        },
        "development",
      ),
    ).toThrow("incomplete or unapproved");
    expect(() =>
      validateCycleBenchmarkManifest(
        { ...manifest, futureSourcePolicy: "unknown" },
        "development",
      ),
    ).toThrow("G3-BENCH-V1");
    expect(() =>
      validateCycleBenchmarkManifest(
        {
          ...manifest,
          authority: { ...manifest.authority, status: "pending" },
        },
        "development",
      ),
    ).toThrow("incomplete or unapproved");
    expect(() =>
      validateCycleBenchmarkManifest(
        {
          ...manifest,
          authority: { ...manifest.authority, approvedAt: "2026-02-30T10:00:00Z" },
        },
        "development",
      ),
    ).toThrow("incomplete or unapproved");
  });

  test("rejects an unapproved manifest before attempting to open outcome data", () => {
    const directory = mkdtempSync(join(tmpdir(), "cycle-benchmark-"));
    tempDirectories.push(directory);
    const manifest = externalManifest();
    manifest.authority = undefined;
    const manifestPath = join(directory, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify(manifest));

    expect(() =>
      loadCycleBenchmarkFiles({
        datasetPath: join(directory, "outcomes-not-present.json"),
        manifestPath,
        partition: "development",
        isGoldenFixture: false,
      }),
    ).toThrow("D-013 dataset authority manifest is incomplete or unapproved");
  });

  test("requires the external split salt identifier to match before opening outcomes", () => {
    const directory = mkdtempSync(join(tmpdir(), "cycle-benchmark-salt-"));
    tempDirectories.push(directory);
    const manifestPath = join(directory, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify(externalManifest()));
    const priorSalt = process.env.CYCLE_BENCHMARK_SPLIT_SALT;
    const priorSaltId = process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID;
    delete process.env.CYCLE_BENCHMARK_SPLIT_SALT;
    delete process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID;
    try {
      expect(() =>
        loadCycleBenchmarkFiles({
          datasetPath: join(directory, "outcomes-not-present.json"),
          manifestPath,
          partition: "development",
          isGoldenFixture: false,
        }),
      ).toThrow("SPLIT_SALT and CYCLE_BENCHMARK_SPLIT_SALT_ID");
    } finally {
      if (priorSalt === undefined) delete process.env.CYCLE_BENCHMARK_SPLIT_SALT;
      else process.env.CYCLE_BENCHMARK_SPLIT_SALT = priorSalt;
      if (priorSaltId === undefined) delete process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID;
      else process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID = priorSaltId;
    }
  });

  test("checks approved source counts, exact fields, and checksum after authority validation", () => {
    const directory = mkdtempSync(join(tmpdir(), "cycle-benchmark-approved-"));
    tempDirectories.push(directory);
    const createdAt = Date.parse("2024-01-01T12:00:00Z");
    const dataset = {
      formatVersion: "g3-cycle-benchmark-data-v1",
      users: [
        {
          userKey: "synthetic-pseudonym-1",
          timezone: "UTC",
          configuredCycleLength: 28,
          events: [
            {
              eventKey: "synthetic-event-1",
              startDate: "2024-01-01",
              startCertainty: "exact",
              createdAt,
              updatedAt: createdAt,
            },
          ],
          segments: [],
        },
      ],
    };
    const dataBytes = Buffer.from(JSON.stringify(dataset));
    const manifest = externalManifest();
    manifest.datasetSha256 = createHash("sha256").update(dataBytes).digest("hex");
    manifest.source = {
      ...manifest.source!,
      userCount: 1,
      outcomeCount: 1,
      fieldsUsed: [
        "userKey",
        "timezone",
        "configuredCycleLength",
        "eventKey",
        "startDate",
        "startCertainty",
        "createdAt",
        "updatedAt",
      ],
    };
    const manifestPath = join(directory, "manifest.json");
    const datasetPath = join(directory, "outcomes.json");
    writeFileSync(manifestPath, JSON.stringify(manifest));
    writeFileSync(datasetPath, dataBytes);
    const priorSalt = process.env.CYCLE_BENCHMARK_SPLIT_SALT;
    const priorSaltId = process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID;
    process.env.CYCLE_BENCHMARK_SPLIT_SALT = "0123456789abcdef";
    process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID = "test-salt-v1";
    try {
      const loaded = loadCycleBenchmarkFiles({
        datasetPath,
        manifestPath,
        partition: "development",
        isGoldenFixture: false,
      });
      expect(loaded.dataset.users).toHaveLength(1);
      expect(loaded.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      if (priorSalt === undefined) delete process.env.CYCLE_BENCHMARK_SPLIT_SALT;
      else process.env.CYCLE_BENCHMARK_SPLIT_SALT = priorSalt;
      if (priorSaltId === undefined) delete process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID;
      else process.env.CYCLE_BENCHMARK_SPLIT_SALT_ID = priorSaltId;
    }
  });
});
