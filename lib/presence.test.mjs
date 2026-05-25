import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HEARTBEAT_INTERVAL_MS,
  PRESENCE_TIMEOUT_MS,
  isPresentAt,
} from "./presence.mjs";

test("presence timing keeps timeout tighter than two heartbeats", () => {
  assert.equal(HEARTBEAT_INTERVAL_MS, 10_000);
  assert.equal(PRESENCE_TIMEOUT_MS, 25_000);
});

test("presence expires from local wall clock without waiting for Convex writes", () => {
  const lastSeen = 1_000;

  assert.equal(isPresentAt(lastSeen, 25_999), true);
  assert.equal(isPresentAt(lastSeen, 26_000), false);
});
