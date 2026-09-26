export type FixtureRole = "primary" | "partner";

const MAX_EMAIL_LOCAL_PART_LENGTH = 64;
const FIXTURE_EMAIL_PREFIX = "cb-connect-e2e+";
const FIXTURE_EMAIL_DOMAIN = "example.com";

function digestRunId(runId: string): string {
  let first = 2166136261;
  let second = 2654435761;
  for (let index = 0; index < runId.length; index += 1) {
    const code = runId.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619) >>> 0;
    second = Math.imul(second ^ (code + index), 16777619) >>> 0;
  }
  // ponytail: portable 48-bit fixture hash; upgrade to shared SHA-256 only if
  // fixture IDs become attacker-controlled rather than CI-generated values.
  return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`.slice(
    0,
    12,
  );
}

export function fixtureEmail(runId: string, role: FixtureRole): string {
  const suffix = `-${role}`;
  const rawLocalPart = `${FIXTURE_EMAIL_PREFIX}${runId}${suffix}`;
  if (rawLocalPart.length <= MAX_EMAIL_LOCAL_PART_LENGTH) {
    return `${rawLocalPart}@${FIXTURE_EMAIL_DOMAIN}`;
  }

  const digest = digestRunId(runId);
  const retainedRunIdLength =
    MAX_EMAIL_LOCAL_PART_LENGTH -
    FIXTURE_EMAIL_PREFIX.length -
    suffix.length -
    digest.length -
    1;
  const boundedRunId = `${runId.slice(0, retainedRunIdLength)}-${digest}`;
  return `${FIXTURE_EMAIL_PREFIX}${boundedRunId}${suffix}@${FIXTURE_EMAIL_DOMAIN}`;
}
