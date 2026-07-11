import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("svix", () => ({
  Webhook: class MockWebhook {
    constructor(secret: string) {
      mocks.constructor(secret);
    }

    verify(body: string, headers: Record<string, string>) {
      return mocks.verify(body, headers);
    }
  },
}));

import { verifyClerkWebhookPayload } from "../app/api/webhook/clerk/verify";

describe("Clerk webhook payload verification", () => {
  beforeEach(() => {
    mocks.constructor.mockReset();
    mocks.verify.mockReset();
  });

  test("passes the exact raw request body to Svix without reserialization", () => {
    const rawBody =
      '{\n  "type": "user.created",\n  "data": { "id": "user_123" }\n}\n';
    const headers = {
      "svix-id": "msg_123",
      "svix-timestamp": "1783800000",
      "svix-signature": "v1,test-signature",
    };
    const event = {
      type: "user.created",
      data: { id: "user_123" },
    };
    mocks.verify.mockReturnValue(event);

    const result = verifyClerkWebhookPayload(
      rawBody,
      "whsec_test-secret",
      headers
    );

    expect(mocks.constructor).toHaveBeenCalledWith("whsec_test-secret");
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.verify).toHaveBeenCalledWith(rawBody, headers);
    expect(result).toBe(event);
  });
});
