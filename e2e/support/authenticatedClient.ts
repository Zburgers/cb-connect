import { type Page, expect } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";

function isTransientNavigationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Execution context was destroyed") ||
    error.message.includes("Cannot find context with specified id") ||
    error.message.includes("Target page, context or browser has been closed")
  );
}

async function readConvexToken(page: Page): Promise<string | null> {
  try {
    return await page.evaluate(async () => {
      const clerk = (window as Window & {
        Clerk?: {
          session?: {
            getToken: (options: { template: string }) => Promise<string | null>;
          };
        };
      }).Clerk;
      return (await clerk?.session?.getToken({ template: "convex" })) ?? null;
    });
  } catch (error) {
    if (isTransientNavigationError(error)) return null;
    throw error;
  }
}

export async function getAuthenticatedConvexClient(
  page: Page,
): Promise<ConvexHttpClient> {
  const convexUrl = process.env.NEXT_PUBLIC_TEST_CONVEX_URL?.trim();
  if (!convexUrl) {
    throw new Error("authenticated_fixture_convex_url_missing");
  }

  let token: string | null = null;
  await expect
    .poll(
      async () => {
        token = await readConvexToken(page);
        return token !== null;
      },
      {
        timeout: 30000,
        intervals: [100, 250, 500, 1000],
      },
    )
    .toBe(true);

  if (!token) {
    throw new Error("authenticated_fixture_convex_token_missing");
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}
