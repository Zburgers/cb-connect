import { describe, expect, test } from "vitest";
import { resolveNutritionTipsPhase } from "./nutritionTipsPresentation";

describe("dashboard nutrition tip phase", () => {
  test("keeps prediction-backed tips visible without legacy cycle info", () => {
    expect(resolveNutritionTipsPhase("menstruation", null)).toBe("menstruation");
  });

  test("falls back to the legacy cycle phase when prediction phase is absent", () => {
    expect(resolveNutritionTipsPhase(null, "luteal")).toBe("luteal");
  });
});
