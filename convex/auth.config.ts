const clerkFrontendApiUrl = process.env.CLERK_FRONTEND_API_URL;

if (!clerkFrontendApiUrl) {
  throw new Error("Missing CLERK_FRONTEND_API_URL");
}

// Support multiple Clerk instances (e.g. test + prod) when the same Convex
// deployment is used across environments.
const domains = clerkFrontendApiUrl
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

if (domains.length === 0) {
  throw new Error("CLERK_FRONTEND_API_URL must contain at least one domain");
}

export default {
  providers: domains.map((domain) => ({
    domain,
    applicationID: "convex",
  })),
};
