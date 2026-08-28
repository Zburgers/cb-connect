import { mutation, type MutationCtx } from "./_generated/server";

async function upsertPainTip(ctx: MutationCtx, tip: {
  phase: "menstruation" | "follicular" | "ovulation" | "luteal";
  painSeverity: "none" | "mild" | "moderate" | "severe";
  title: string;
  suggestions: string[];
  safetyNote: string;
  isActive: boolean;
  priority: number;
}) {
  const matches = await ctx.db
    .query("painTips")
    .withIndex("by_phase_and_severity", (q) =>
      q.eq("phase", tip.phase).eq("painSeverity", tip.painSeverity)
    )
    .collect();

  if (matches.length === 0) {
    await ctx.db.insert("painTips", tip);
    return;
  }

  for (const match of matches) {
    await ctx.db.patch(match._id, tip);
  }
}

async function upsertNutritionTip(ctx: MutationCtx, tip: {
  phase: "menstruation" | "follicular" | "ovulation" | "luteal";
  foodItem: string;
  reasoning: string;
  isActive: boolean;
  priority: number;
}) {
  const matches = await ctx.db
    .query("nutritionTips")
    .withIndex("by_phase", (q) => q.eq("phase", tip.phase))
    .filter((q) => q.eq(q.field("foodItem"), tip.foodItem))
    .collect();

  if (matches.length === 0) {
    await ctx.db.insert("nutritionTips", tip);
    return;
  }

  for (const match of matches) {
    await ctx.db.patch(match._id, tip);
  }
}

export const seedPainTips = mutation({
  handler: async (ctx) => {
    const tips = [
      // Menstruation phase
      { phase: "menstruation" as const, painSeverity: "none" as const, title: "Keep it up!", suggestions: ["Light stretching can help maintain comfort", "Stay hydrated with warm beverages"], safetyNote: "Listen to your body and rest when needed.", isActive: true, priority: 1 },
      { phase: "menstruation" as const, painSeverity: "mild" as const, title: "Mild Discomfort Tips", suggestions: ["Try a warm compress on your lower abdomen", "Gentle yoga or walking can help", "Chamomile or ginger tea may ease discomfort"], safetyNote: "If pain persists or worsens, consult your healthcare provider.", isActive: true, priority: 1 },
      { phase: "menstruation" as const, painSeverity: "moderate" as const, title: "Managing Moderate Pain", suggestions: ["Apply heat therapy (heating pad or warm bath)", "Consider OTC pain relief as directed", "Rest in a comfortable position", "Try deep breathing exercises"], safetyNote: "If OTC medication doesn't help, please see a doctor.", isActive: true, priority: 1 },
      { phase: "menstruation" as const, painSeverity: "severe" as const, title: "Severe Pain Support", suggestions: ["Rest is important - take it easy", "Heat therapy can provide some relief", "Consider speaking with your doctor about pain management"], safetyNote: "Severe pain that disrupts daily life should be evaluated by a healthcare professional.", isActive: true, priority: 1 },

      // Follicular phase
      { phase: "follicular" as const, painSeverity: "none" as const, title: "Supportive Movement", suggestions: ["Choose movement that feels comfortable", "Hydration can be part of your routine"], safetyNote: "Adjust to your own energy and comfort.", isActive: true, priority: 1 },
      { phase: "follicular" as const, painSeverity: "mild" as const, title: "Gentle Support", suggestions: ["Light movement may feel comfortable", "Choose iron-rich foods if they suit you"], safetyNote: "Lingering pain can be discussed with your doctor.", isActive: true, priority: 1 },
      { phase: "follicular" as const, painSeverity: "moderate" as const, title: "Unexpected Discomfort", suggestions: ["Rest and hydrate", "Monitor what you notice"], safetyNote: "If pain continues or changes, consider consulting your healthcare provider.", isActive: true, priority: 1 },
      { phase: "follicular" as const, painSeverity: "severe" as const, title: "Please See a Doctor", suggestions: ["Severe pain deserves medical attention", "Rest and use heat therapy in the meantime"], safetyNote: "Please consult your healthcare provider about severe or disruptive pain.", isActive: true, priority: 1 },

      // Ovulation phase
      { phase: "ovulation" as const, painSeverity: "none" as const, title: "Mid-Cycle Support", suggestions: ["Choose activities that feel comfortable", "Keep meals and hydration aligned with your needs"], safetyNote: "Calendar timing is an estimate and does not confirm ovulation.", isActive: true, priority: 1 },
      { phase: "ovulation" as const, painSeverity: "mild" as const, title: "Mid-Cycle Discomfort", suggestions: ["A warm compress can help", "Stay active with gentle exercise if it feels comfortable"], safetyNote: "If pain recurs, mention it at your next checkup.", isActive: true, priority: 1 },
      { phase: "ovulation" as const, painSeverity: "moderate" as const, title: "Mid-Cycle Discomfort", suggestions: ["Rest when needed", "Heat therapy may help", "Over-the-counter pain relief as directed"], safetyNote: "If pain is recurring or disruptive, consider medical advice.", isActive: true, priority: 1 },
      { phase: "ovulation" as const, painSeverity: "severe" as const, title: "Severe Pain Support", suggestions: ["Rest is important", "Consider contacting your healthcare provider"], safetyNote: "Severe or disruptive pain should be evaluated by a medical professional.", isActive: true, priority: 1 },

      // Luteal phase
      { phase: "luteal" as const, painSeverity: "none" as const, title: "Steady Support", suggestions: ["Maintain balanced nutrition", "Gentle movement may feel comfortable"], safetyNote: "Use your own experience as guidance.", isActive: true, priority: 1 },
      { phase: "luteal" as const, painSeverity: "mild" as const, title: "Comfort Tips", suggestions: ["Reduce caffeine or salt only if you notice they affect you", "Magnesium-rich foods may be part of a varied diet", "Gentle walks and stretching"], safetyNote: "Track what feels useful to you over time.", isActive: true, priority: 1 },
      { phase: "luteal" as const, painSeverity: "moderate" as const, title: "Rest and Support", suggestions: ["Prioritize sleep and rest", "Warm baths can ease discomfort", "Stress reduction techniques"], safetyNote: "If symptoms significantly affect your quality of life, discuss them with your doctor.", isActive: true, priority: 1 },
      { phase: "luteal" as const, painSeverity: "severe" as const, title: "Support for Difficult Days", suggestions: ["Rest and self-care are important", "Reach out to your support system", "Consider professional support"], safetyNote: "Severe or disruptive symptoms should be discussed with your healthcare provider.", isActive: true, priority: 1 },
    ];

    for (const tip of tips) {
      await upsertPainTip(ctx, tip);
    }

    return `Seeded ${tips.length} pain tips`;
  },
});

export const seedNutritionTips = mutation({
  handler: async (ctx) => {
    const tips = [
      // Menstruation
      { phase: "menstruation" as const, foodItem: "Dark Chocolate (70%+)", reasoning: "Rich in magnesium which helps relax muscles and reduce cramps", isActive: true, priority: 1 },
      { phase: "menstruation" as const, foodItem: "Spinach & Leafy Greens", reasoning: "High in iron to replenish what's lost during menstruation", isActive: true, priority: 2 },
      { phase: "menstruation" as const, foodItem: "Salmon", reasoning: "Omega-3 fatty acids have anti-inflammatory properties that may reduce pain", isActive: true, priority: 3 },
      { phase: "menstruation" as const, foodItem: "Ginger Tea", reasoning: "Natural anti-inflammatory that can ease nausea and cramps", isActive: true, priority: 4 },
      { phase: "menstruation" as const, foodItem: "Bananas", reasoning: "Potassium helps reduce water retention and bloating", isActive: true, priority: 5 },
      { phase: "menstruation" as const, foodItem: "Red Meat (lean)", reasoning: "Excellent source of iron and B12 to combat fatigue", isActive: true, priority: 6 },

      // Follicular
      { phase: "follicular" as const, foodItem: "Fermented Foods (kimchi, yogurt)", reasoning: "A varied diet can support everyday nourishment", isActive: true, priority: 1 },
      { phase: "follicular" as const, foodItem: "Eggs", reasoning: "Protein can support a satisfying meal", isActive: true, priority: 2 },
      { phase: "follicular" as const, foodItem: "Citrus Fruits", reasoning: "Vitamin C is part of a varied diet", isActive: true, priority: 3 },
      { phase: "follicular" as const, foodItem: "Flaxseeds", reasoning: "A source of fiber and healthy fats", isActive: true, priority: 4 },
      { phase: "follicular" as const, foodItem: "Quinoa", reasoning: "Complex carbs and protein for sustained energy", isActive: true, priority: 5 },

      // Ovulation
      { phase: "ovulation" as const, foodItem: "Berries", reasoning: "A colorful addition to a varied diet", isActive: true, priority: 1 },
      { phase: "ovulation" as const, foodItem: "Whole Grains", reasoning: "Fiber can support a balanced meal", isActive: true, priority: 2 },
      { phase: "ovulation" as const, foodItem: "Cruciferous Vegetables", reasoning: "A practical way to add vegetables", isActive: true, priority: 3 },
      { phase: "ovulation" as const, foodItem: "Lean Protein", reasoning: "Protein can round out a meal", isActive: true, priority: 4 },

      // Luteal
      { phase: "luteal" as const, foodItem: "Sweet Potatoes", reasoning: "A source of carbohydrates for a satisfying meal", isActive: true, priority: 1 },
      { phase: "luteal" as const, foodItem: "Pumpkin Seeds", reasoning: "A source of magnesium and zinc", isActive: true, priority: 2 },
      { phase: "luteal" as const, foodItem: "Turkey", reasoning: "Protein can be part of a balanced meal", isActive: true, priority: 3 },
      { phase: "luteal" as const, foodItem: "Avocado", reasoning: "Healthy fats can add texture and satisfaction", isActive: true, priority: 4 },
      { phase: "luteal" as const, foodItem: "Chamomile Tea", reasoning: "A warm, non-caffeinated drink option", isActive: true, priority: 5 },
      { phase: "luteal" as const, foodItem: "Walnuts", reasoning: "A source of healthy fats", isActive: true, priority: 6 },
    ];

    for (const tip of tips) {
      await upsertNutritionTip(ctx, tip);
    }

    return `Seeded ${tips.length} nutrition tips`;
  },
});
