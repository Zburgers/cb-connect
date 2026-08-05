export const APPROVED_CLERK_ENVIRONMENT = "holy clark";
export const APPROVED_CONVEX_DEPLOYMENT = "dev:hallowed-hummingbird-284";

const CLERK_FRONTEND_HOST_SUFFIX = ".clerk.accounts.dev";
const SAFE_RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export type EnvironmentInput = Readonly<
  Record<string, string | undefined>
>;

export type AuthEnvironment = {
  clerkEnvironmentName: string;
  clerkSecretKey: string;
  clerkPublishableKey: string;
  clerkFrontendApiUrl: string;
  convexDeployment: string;
  convexUrl: string;
  runId: string;
  storageDir: string;
  primaryStorageStatePath: string;
  partnerStorageStatePath: string;
  baseUrl: string;
};

export type FixtureRole = "primary" | "partner";

export type FixtureUserSpec = {
  role: FixtureRole;
  email: string;
  password: string;
};

export type ProvisionedFixtureUser = Partial<FixtureUserSpec> & {
  role: FixtureRole;
  clerkId: string;
};

export type ProvisionedFixturePair = {
  runId: string;
  primary: ProvisionedFixtureUser;
  partner: ProvisionedFixtureUser;
};

export type FixtureServices = {
  createUser: (spec: FixtureUserSpec) => Promise<{ clerkId: string }>;
  deleteUser: (clerkId: string) => Promise<void>;
  cleanupApplicationData?: (pair: ProvisionedFixturePair) => Promise<void>;
};

type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
};

const defaultSleep = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, delayMs));

function requiredValue(environment: EnvironmentInput, key: string): string {
  const value = environment[key]?.trim();
  if (!value) {
    throw new Error(`Missing approved authenticated fixture environment: ${key}`);
  }
  return value;
}

function isHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isTestKey(value: string, expectedPrefix: "sk" | "pk"): boolean {
  const [prefix, environment] = value.split("_", 3);
  return prefix === expectedPrefix && environment === "test";
}

function isTransientError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const record = error as Record<string, unknown>;
  const status = record.status ?? record.statusCode;
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (typeof status === "number" && status >= 500 && status <= 599) ||
    record.code === "ETIMEDOUT" ||
    record.code === "ECONNRESET"
  );
}

function isAlreadyGoneError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const record = error as Record<string, unknown>;
  return record.status === 404 || record.statusCode === 404;
}

export function loadAuthEnvironment(
  environment: EnvironmentInput = process.env,
): AuthEnvironment {
  const clerkEnvironmentName = requiredValue(
    environment,
    "CLERK_TEST_ENVIRONMENT_NAME",
  );
  const clerkSecretKey = requiredValue(environment, "CLERK_TEST_SECRET_KEY");
  const clerkPublishableKey = requiredValue(
    environment,
    "NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY",
  );
  const clerkFrontendApiUrl = requiredValue(
    environment,
    "CLERK_TEST_FRONTEND_API_URL",
  );
  const convexDeployment = requiredValue(
    environment,
    "CONVEX_TEST_DEPLOYMENT",
  );
  const convexUrl = requiredValue(
    environment,
    "NEXT_PUBLIC_TEST_CONVEX_URL",
  );
  const runId = requiredValue(
    environment,
    "CB_CONNECT_RELEASE_RUN_ID",
  );

  const clerkUrl = isHttpsUrl(clerkFrontendApiUrl);
  const convexAddress = isHttpsUrl(convexUrl);
  if (
    clerkEnvironmentName !== APPROVED_CLERK_ENVIRONMENT ||
    !isTestKey(clerkSecretKey, "sk") ||
    !isTestKey(clerkPublishableKey, "pk") ||
    clerkUrl === null ||
    !clerkUrl.hostname.endsWith(CLERK_FRONTEND_HOST_SUFFIX) ||
    convexDeployment !== APPROVED_CONVEX_DEPLOYMENT ||
    convexAddress === null ||
    !convexAddress.hostname.includes("hallowed-hummingbird-284") ||
    convexAddress.hostname.includes("festive-malamute-715") ||
    !SAFE_RUN_ID_PATTERN.test(runId)
  ) {
    throw new Error(
      "Missing approved authenticated fixture environment: identity validation failed",
    );
  }

  const storageRoot = environment.CB_CONNECT_RELEASE_AUTH_DIR?.trim() || "e2e/.auth";
  const storageDir = `${storageRoot}/${runId}`;

  return {
    clerkEnvironmentName,
    clerkSecretKey,
    clerkPublishableKey,
    clerkFrontendApiUrl,
    convexDeployment,
    convexUrl,
    runId,
    storageDir,
    primaryStorageStatePath: `${storageDir}/primary.json`,
    partnerStorageStatePath: `${storageDir}/partner.json`,
    baseUrl: environment.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3000",
  };
}

export async function withTransientRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 100;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts || !isTransientError(error)) {
        throw error;
      }
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error("fixture_operation_failed");
}

function fixtureSpecs(
  environment: AuthEnvironment,
  passwordFactory: (role: FixtureRole) => string,
): [FixtureUserSpec, FixtureUserSpec] {
  return (["primary", "partner"] as const).map((role) => ({
    role,
    email: `cb-connect-e2e+${environment.runId}-${role}@example.com`,
    password: passwordFactory(role),
  })) as [FixtureUserSpec, FixtureUserSpec];
}

function redactedProvisioningError(): Error {
  return new Error("fixture_provisioning_failed");
}

export async function provisionFixturePair(
  environment: AuthEnvironment,
  services: FixtureServices,
  options: RetryOptions & { passwordFactory: (role: FixtureRole) => string },
): Promise<ProvisionedFixturePair> {
  const [primarySpec, partnerSpec] = fixtureSpecs(
    environment,
    options.passwordFactory,
  );

  let primary: ProvisionedFixtureUser;
  try {
    const created = await withTransientRetry(
      () => services.createUser(primarySpec),
      options,
    );
    primary = { ...primarySpec, clerkId: created.clerkId };
  } catch {
    throw redactedProvisioningError();
  }

  try {
    const created = await withTransientRetry(
      () => services.createUser(partnerSpec),
      options,
    );
    return {
      runId: environment.runId,
      primary,
      partner: { ...partnerSpec, clerkId: created.clerkId },
    };
  } catch {
    try {
      await withTransientRetry(() => services.deleteUser(primary.clerkId), options);
    } catch {
      // Preserve the bounded provisioning error; cleanup is retried by teardown.
    }
    throw redactedProvisioningError();
  }
}

export async function cleanupFixturePair(
  pair: ProvisionedFixturePair,
  services: Pick<FixtureServices, "deleteUser" | "cleanupApplicationData">,
  options: RetryOptions = {},
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (services.cleanupApplicationData) {
    try {
      await withTransientRetry(
        () => services.cleanupApplicationData!(pair),
        options,
      );
    } catch {
      errors.push("application_cleanup_failed");
    }
  }

  for (const user of [pair.partner, pair.primary]) {
    try {
      await withTransientRetry(() => services.deleteUser(user.clerkId), options);
    } catch (error) {
      if (!isAlreadyGoneError(error)) {
        errors.push(`${user.role}_user_cleanup_failed`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

type ClerkUserResponse = { id: string };

function isClerkUserResponse(value: unknown): value is ClerkUserResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

export function createClerkFixtureServices(
  environment: AuthEnvironment,
  fetchImplementation: typeof fetch = fetch,
): FixtureServices {
  const request = async (
    path: string,
    init: RequestInit,
  ): Promise<unknown> => {
    const response = await fetchImplementation(`https://api.clerk.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${environment.clerkSecretKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw Object.assign(new Error("clerk_request_failed"), {
        status: response.status,
      });
    }

    return response.status === 204 ? null : response.json();
  };

  return {
    createUser: async (spec) => {
      const response = await request("/users", {
        method: "POST",
        body: JSON.stringify({
          email_address: [spec.email],
          password: spec.password,
          first_name: "CB",
          last_name: spec.role === "primary" ? "Primary" : "Partner",
          public_metadata: {
            cbConnectFixtureRun: environment.runId,
            cbConnectFixtureRole: spec.role,
          },
        }),
      });

      if (!isClerkUserResponse(response)) {
        throw new Error("clerk_response_invalid");
      }

      return { clerkId: response.id };
    },
    deleteUser: async (clerkId) => {
      await request(`/users/${encodeURIComponent(clerkId)}`, {
        method: "DELETE",
      });
    },
  };
}
