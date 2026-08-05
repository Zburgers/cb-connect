export type ReleaseInfo = {
  commitSha: string;
  buildId: string;
  compatibilityVersion: string;
  builtAt: string;
};

type ReleaseMetadataEnv = Readonly<Record<string, string | undefined>>;

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;
const BOUNDED_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const COMPATIBILITY_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isIsoTimestamp(value: string): boolean {
  return (
    ISO_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

export function parseReleaseInfo(
  env: ReleaseMetadataEnv,
): ReleaseInfo | null {
  const commitSha = env.CB_CONNECT_COMMIT_SHA;
  const buildId = env.CB_CONNECT_BUILD_ID;
  const compatibilityVersion = env.CB_CONNECT_COMPATIBILITY_VERSION;
  const builtAt = env.CB_CONNECT_BUILT_AT;

  if (
    typeof commitSha !== "string" ||
    typeof buildId !== "string" ||
    typeof compatibilityVersion !== "string" ||
    typeof builtAt !== "string"
  ) {
    return null;
  }

  if (
    !COMMIT_SHA_PATTERN.test(commitSha) ||
    !BOUNDED_TOKEN_PATTERN.test(buildId) ||
    !COMPATIBILITY_VERSION_PATTERN.test(compatibilityVersion) ||
    !isIsoTimestamp(builtAt)
  ) {
    return null;
  }

  return {
    commitSha,
    buildId,
    compatibilityVersion,
    builtAt,
  };
}

export function serializeReleaseInfo(
  info: ReleaseInfo | null,
): ReleaseInfo | null {
  if (info === null) {
    return null;
  }

  return {
    commitSha: info.commitSha,
    buildId: info.buildId,
    compatibilityVersion: info.compatibilityVersion,
    builtAt: info.builtAt,
  };
}
