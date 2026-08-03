import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { POST } from "./route";

describe("Clerk webhook relay", () => {
  const originalFetch = globalThis.fetch;
  const originalSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "https://example.convex.site";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_CONVEX_SITE_URL = originalSiteUrl;
    }
  });

  test("forwards the exact raw body and Svix headers", async () => {
    const rawBody = '{\n  "type": "user.created"\n}\n';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("OK", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    globalThis.fetch = fetchMock;

    const response = await POST(
      new Request("https://app.example/api/webhook/clerk", {
        method: "POST",
        body: rawBody,
        headers: {
          "content-type": "application/json",
          "svix-id": "msg_123",
          "svix-timestamp": "1783800000",
          "svix-signature": "v1,test-signature",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit];
    expect(url.toString()).toBe("https://example.convex.site/webhooks/clerk");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(rawBody);
    expect(new Headers(init.headers).get("svix-signature")).toBe("v1,test-signature");
    expect(new Headers(init.headers).get("svix-timestamp")).toBe("1783800000");
    expect(new Headers(init.headers).get("svix-id")).toBe("msg_123");
  });
});
