import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";

import { api } from "../../../convex/_generated/api";
import {
  parseReleaseInfo,
  serializeReleaseInfo,
  type ReleaseInfo,
} from "../../../lib/releaseInfo";

const READINESS_TIMEOUT_MS = 1000;
const REQUIRED_COMPATIBILITY_VERSION = "v1";
const DEPLOYMENT_PATTERN =
  /^(dev|preview|test|prod):[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type BackendIdentity = {
  deployment: string;
  compatibilityVersion: string;
  deployedAt: string;
};

type ReadinessResponse = {
  status: "ready" | "not_ready";
  service: "cb-connect";
  frontend: ReleaseInfo | null;
  backend: BackendIdentity | null;
  checks: {
    metadata: "pass" | "fail";
    backend: "pass" | "timeout" | "unavailable";
    compatibility: "pass" | "mismatch" | "unknown";
  };
};

class ReadinessTimeoutError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalIsoTimestamp(value: string): boolean {
  return (
    ISO_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function parseBackendIdentity(value: unknown): BackendIdentity | null {
  if (!isRecord(value)) {
    return null;
  }

  const { deployment, compatibilityVersion, deployedAt } = value;
  if (
    typeof deployment !== "string" ||
    typeof compatibilityVersion !== "string" ||
    typeof deployedAt !== "string" ||
    !DEPLOYMENT_PATTERN.test(deployment) ||
    !TOKEN_PATTERN.test(compatibilityVersion) ||
    !isCanonicalIsoTimestamp(deployedAt)
  ) {
    return null;
  }

  return { deployment, compatibilityVersion, deployedAt };
}

function createNotReadyResponse(
  frontend: ReleaseInfo | null,
  backend: BackendIdentity | null,
  checks: ReadinessResponse["checks"],
) {
  const body: ReadinessResponse = {
    status: "not_ready",
    service: "cb-connect",
    frontend: serializeReleaseInfo(frontend),
    backend,
    checks,
  };

  return NextResponse.json(body, { status: 503 });
}

async function queryBackendIdentity(): Promise<
  | { kind: "pass"; identity: BackendIdentity }
  | { kind: "timeout" }
  | { kind: "unavailable" }
> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return { kind: "unavailable" };
  }

  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const client = new ConvexHttpClient(convexUrl, {
      logger: false,
      fetch: (input, init) =>
        globalThis.fetch(input, {
          ...init,
          signal: abortController.signal,
        }),
    });

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        reject(new ReadinessTimeoutError());
      }, READINESS_TIMEOUT_MS);
    });

    const result = await Promise.race([
      client.query(api.queries.system.getBackendIdentity, {}),
      timeout,
    ]);
    const identity = parseBackendIdentity(result);

    return identity === null
      ? { kind: "unavailable" }
      : { kind: "pass", identity };
  } catch (error) {
    if (error instanceof ReadinessTimeoutError) {
      return { kind: "timeout" };
    }

    return { kind: "unavailable" };
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    abortController.abort();
  }
}

export async function GET() {
  const frontend = serializeReleaseInfo(
    parseReleaseInfo(process.env as Record<string, string | undefined>),
  );

  if (frontend === null) {
    return createNotReadyResponse(null, null, {
      metadata: "fail",
      backend: "unavailable",
      compatibility: "unknown",
    });
  }

  const backendResult = await queryBackendIdentity();
  if (backendResult.kind !== "pass") {
    return createNotReadyResponse(frontend, null, {
      metadata: "pass",
      backend: backendResult.kind,
      compatibility: "unknown",
    });
  }

  const compatibilityMatches =
    frontend.compatibilityVersion === REQUIRED_COMPATIBILITY_VERSION &&
    backendResult.identity.compatibilityVersion ===
      REQUIRED_COMPATIBILITY_VERSION &&
    frontend.compatibilityVersion === backendResult.identity.compatibilityVersion;

  if (!compatibilityMatches) {
    return createNotReadyResponse(frontend, backendResult.identity, {
      metadata: "pass",
      backend: "pass",
      compatibility: "mismatch",
    });
  }

  const body: ReadinessResponse = {
    status: "ready",
    service: "cb-connect",
    frontend,
    backend: backendResult.identity,
    checks: {
      metadata: "pass",
      backend: "pass",
      compatibility: "pass",
    },
  };

  return NextResponse.json(body, { status: 200 });
}
