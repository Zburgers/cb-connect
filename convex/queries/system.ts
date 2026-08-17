import { query } from "../_generated/server";
import { v } from "convex/values";

const backendIdentityValidator = v.union(
  v.object({
    deployment: v.string(),
    compatibilityVersion: v.string(),
    deployedAt: v.string(),
  }),
  v.null(),
);

const DEPLOYMENT_PATTERN =
  /^(dev|preview|test|prod):[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isCanonicalIsoTimestamp(value: string): boolean {
  return (
    ISO_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

export const getBackendIdentity = query({
  args: {},
  returns: backendIdentityValidator,
  handler: async () => {
    const deployment = process.env.CB_CONNECT_BACKEND_DEPLOYMENT;
    const compatibilityVersion =
      process.env.CB_CONNECT_BACKEND_COMPATIBILITY_VERSION;
    const deployedAt = process.env.CB_CONNECT_BACKEND_DEPLOYED_AT;

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

    return {
      deployment,
      compatibilityVersion,
      deployedAt,
    };
  },
});
