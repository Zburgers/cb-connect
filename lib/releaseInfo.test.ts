import { describe, expect, test } from "vitest";

import { parseReleaseInfo, serializeReleaseInfo } from "./releaseInfo";

const completeMetadata = {
  CB_CONNECT_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567",
  CB_CONNECT_BUILD_ID: "build-2026-08-05-001",
  CB_CONNECT_COMPATIBILITY_VERSION: "v1",
  CB_CONNECT_BUILT_AT: "2026-08-05T15:00:00.000Z",
};

describe("parseReleaseInfo", () => {
  test("parses complete approved metadata", () => {
    expect(parseReleaseInfo(completeMetadata)).toEqual({
      commitSha: completeMetadata.CB_CONNECT_COMMIT_SHA,
      buildId: completeMetadata.CB_CONNECT_BUILD_ID,
      compatibilityVersion: completeMetadata.CB_CONNECT_COMPATIBILITY_VERSION,
      builtAt: completeMetadata.CB_CONNECT_BUILT_AT,
    });
  });

  test.each([
    "CB_CONNECT_COMMIT_SHA",
    "CB_CONNECT_BUILD_ID",
    "CB_CONNECT_COMPATIBILITY_VERSION",
    "CB_CONNECT_BUILT_AT",
  ])("fails closed when %s is missing", (field) => {
    const metadata = { ...completeMetadata };
    delete metadata[field as keyof typeof metadata];

    expect(parseReleaseInfo(metadata)).toBeNull();
  });

  test("fails closed for a malformed timestamp", () => {
    expect(
      parseReleaseInfo({
        ...completeMetadata,
        CB_CONNECT_BUILT_AT: "not-a-timestamp",
      }),
    ).toBeNull();
  });

  test("fails closed for an invalid commit SHA", () => {
    expect(
      parseReleaseInfo({
        ...completeMetadata,
        CB_CONNECT_COMMIT_SHA: "not-a-sha",
      }),
    ).toBeNull();
  });

  test("ignores extra sensitive inputs", () => {
    expect(
      parseReleaseInfo({
        ...completeMetadata,
        CLERK_SECRET_KEY: "sensitive-marker",
        CONVEX_DEPLOY_KEY: "sensitive-marker",
      }),
    ).toEqual({
      commitSha: completeMetadata.CB_CONNECT_COMMIT_SHA,
      buildId: completeMetadata.CB_CONNECT_BUILD_ID,
      compatibilityVersion: completeMetadata.CB_CONNECT_COMPATIBILITY_VERSION,
      builtAt: completeMetadata.CB_CONNECT_BUILT_AT,
    });
  });
});

test("serializeReleaseInfo exposes only the bounded public identity", () => {
  const info = parseReleaseInfo(completeMetadata);

  expect(
    serializeReleaseInfo({
      ...info!,
      CLERK_SECRET_KEY: "sensitive-marker",
      CONVEX_DEPLOY_KEY: "sensitive-marker",
    } as typeof info),
  ).toEqual(info);
});
