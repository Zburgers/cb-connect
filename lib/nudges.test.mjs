import assert from "node:assert/strict";
import { test } from "node:test";

import {
  NUDGE_EMOJIS,
  getNudgeMessage,
  isNudgeEmoji,
} from "./nudges.mjs";

test("nudge emoji contract accepts only supported realtime nudges", () => {
  assert.deepEqual(NUDGE_EMOJIS, ["💗", "🤗", "☕", "🌙", "✨", "🫶"]);
  assert.equal(isNudgeEmoji("🤗"), true);
  assert.equal(isNudgeEmoji("🔥"), false);
});

test("nudge emoji contract returns dashboard-safe copy", () => {
  assert.equal(getNudgeMessage("☕"), "A small comfort check-in");
  assert.equal(getNudgeMessage("🔥"), "A gentle nudge");
});
