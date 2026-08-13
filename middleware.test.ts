import { expect, test } from "vitest";

import {
  config,
  isPublicOperationalPath,
  PUBLIC_OPERATIONAL_PATHS,
} from "./middleware";

test("operational endpoints are explicitly public", () => {
  expect(PUBLIC_OPERATIONAL_PATHS).toEqual(["/api/health", "/api/ready"]);
  expect(isPublicOperationalPath("/api/health")).toBe(true);
  expect(isPublicOperationalPath("/api/ready")).toBe(true);
  expect(isPublicOperationalPath("/api/webhook/clerk")).toBe(false);
});

test("Clerk matcher excludes operational endpoints", () => {
  expect(config.matcher).toHaveLength(1);
  expect(config.matcher[0]).toContain("api/(?:health|ready)(?:/|$)");
  expect(config.matcher[0]).not.toBe("/(api|trpc)(.*)");
});
