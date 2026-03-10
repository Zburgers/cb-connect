import { mutation } from "./_generated/server";

export const seedPainTips = mutation({
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("painTips").first();
    if (existing) return "Already seeded";

    const tips = [
      // Menstruation phase
      { phase: "menstruation" as const, painSeverity: "none" as const, title: "Keep it up!", suggestions: ["Light stretching can help maintain comfort", "Stay hydrated with warm beverages"], safetyNote: "Listen to your body and rest when needed.", isActive: true, priority: 1 },
      { phase: "menstruation" as const, painSeverity: "mild" as const, title: "Mild Discomfort Tips", suggestions: ["Try a warm compress on your lower abdomen", "Gentle yoga or walking can help", "Chamomile or ginger tea may ease discomfort"], safetyNote: "If pain persists or worsens, consult your healthcare provider.", isActive: true, priority: 1 },
      { phase: "menstruation" as const, painSeverity: "moderate" as const, title: "Managing Moderate Pain", suggestions: ["Apply heat therapy (heating pad or warm bath)", "Consider OTC pain relief as directed", "Rest in a comfortable position", "Try deep breathing exercises"], safetyNote: "If OTC medication doesn't help, please see a doctor.", isActive: true, priority: 1 },
      { phase: "menstruation" as const, painSeverity: "severe" as const, title: "Severe Pain Support", suggestions: ["Rest is important - take it easy", "Heat therapy can provide some relief", "Consider speaking with your doctor about pain management", "Your partner may want to check in"], safetyNote: "Severe menstrual pain that disrupts daily life should be evaluated by a healthcare professional.", isActive: true, priority: 1 },

      // Follicular phase
      { phase: "follicular" as const, painSeverity: "none" as const, title: "Post-Period Energy", suggestions: ["Great time for exercise and activity", "Energy levels typically rising"], safetyNote: "Enjoy the energy boost!", isActive: true, priority: 1 },
      { phase: "follicular" as const, painSeverity: "mild" as const, title: "Follicular Phase Care", suggestions: ["Light exercise can help with residual discomfort", "Focus on iron-rich foods to recover"], safetyNote: "Lingering pain after your period should be mentioned to your doctor.", isActive: true, priority: 1 },
      { phase: "follicular" as const, painSeverity: "moderate" as const, title: "Unexpected Discomfort", suggestions: ["Rest and hydrate", "Monitor symptoms"], safetyNote: "Pain during the follicular phase is uncommon. Consider consulting your healthcare provider.", isActive: true, priority: 1 },
      { phase: "follicular" as const, painSeverity: "severe" as const, title: "Please See a Doctor", suggestions: ["Severe pain outside menstruation warrants medical attention", "Rest and use heat therapy in the meantime"], safetyNote: "This level of pain during the follicular phase is not typical. Please consult your healthcare provider.", isActive: true, priority: 1 },

      // Ovulation phase
      { phase: "ovulation" as const, painSeverity: "none" as const, title: "Ovulation Window", suggestions: ["Energy and mood may peak during this phase", "Good time for social activities"], safetyNote: "Normal phase - no concerns.", isActive: true, priority: 1 },
      { phase: "ovulation" as const, painSeverity: "mild" as const, title: "Mittelschmerz (Ovulation Pain)", suggestions: ["Mild ovulation pain is common", "A warm compress can help", "Stay active with gentle exercise"], safetyNote: "Mild ovulation pain (mittelschmerz) is normal for many people.", isActive: true, priority: 1 },
      { phase: "ovulation" as const, painSeverity: "moderate" as const, title: "Ovulation Discomfort", suggestions: ["Rest when needed", "Heat therapy may help", "Over-the-counter pain relief as directed"], safetyNote: "Moderate ovulation pain is less common. If recurring, mention it at your next checkup.", isActive: true, priority: 1 },
      { phase: "ovulation" as const, painSeverity: "severe" as const, title: "Severe Ovulation Pain", suggestions: ["Rest is important", "Consider contacting your healthcare provider"], safetyNote: "Severe pain during ovulation is not typical and should be evaluated by a medical professional.", isActive: true, priority: 1 },

      // Luteal phase
      { phase: "luteal" as const, painSeverity: "none" as const, title: "Pre-Period Phase", suggestions: ["Maintain balanced nutrition", "Gentle exercise can help prevent PMS symptoms"], safetyNote: "Preparing for the next cycle.", isActive: true, priority: 1 },
      { phase: "luteal" as const, painSeverity: "mild" as const, title: "PMS Comfort Tips", suggestions: ["Reduce caffeine and salt intake", "Magnesium-rich foods may help", "Gentle walks and stretching"], safetyNote: "Mild PMS symptoms are common. Track patterns over multiple cycles.", isActive: true, priority: 1 },
      { phase: "luteal" as const, painSeverity: "moderate" as const, title: "Managing PMS", suggestions: ["Prioritize sleep and rest", "Warm baths can ease discomfort", "Consider calcium supplements (with doctor approval)", "Stress reduction techniques"], safetyNote: "If PMS significantly affects your quality of life, discuss PMDD screening with your doctor.", isActive: true, priority: 1 },
      { phase: "luteal" as const, painSeverity: "severe" as const, title: "Severe PMS/PMDD", suggestions: ["Rest and self-care are essential", "Reach out to your support system", "Consider professional support"], safetyNote: "Severe pre-menstrual symptoms may indicate PMDD. Please speak with your healthcare provider.", isActive: true, priority: 1 },
    ];

    for (const tip of tips) {
      await ctx.db.insert("painTips", tip);
    }

    return `Seeded ${tips.length} pain tips`;
  },
});

export const seedNutritionTips = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("nutritionTips").first();
    if (existing) return "Already seeded";

    const tips = [
      // Menstruation
      { phase: "menstruation" as const, foodItem: "Dark Chocolate (70%+)", reasoning: "Rich in magnesium which helps relax muscles and reduce cramps", isActive: true, priority: 1 },
      { phase: "menstruation" as const, foodItem: "Spinach & Leafy Greens", reasoning: "High in iron to replenish what's lost during menstruation", isActive: true, priority: 2 },
      { phase: "menstruation" as const, foodItem: "Salmon", reasoning: "Omega-3 fatty acids have anti-inflammatory properties that may reduce pain", isActive: true, priority: 3 },
      { phase: "menstruation" as const, foodItem: "Ginger Tea", reasoning: "Natural anti-inflammatory that can ease nausea and cramps", isActive: true, priority: 4 },
      { phase: "menstruation" as const, foodItem: "Bananas", reasoning: "Potassium helps reduce water retention and bloating", isActive: true, priority: 5 },
      { phase: "menstruation" as const, foodItem: "Red Meat (lean)", reasoning: "Excellent source of iron and B12 to combat fatigue", isActive: true, priority: 6 },

      // Follicular
      { phase: "follicular" as const, foodItem: "Fermented Foods (kimchi, yogurt)", reasoning: "Support gut health and estrogen metabolism as levels rise", isActive: true, priority: 1 },
      { phase: "follicular" as const, foodItem: "Eggs", reasoning: "Complete protein source to support rising energy levels", isActive: true, priority: 2 },
      { phase: "follicular" as const, foodItem: "Citrus Fruits", reasoning: "Vitamin C supports iron absorption and immune function", isActive: true, priority: 3 },
      { phase: "follicular" as const, foodItem: "Flaxseeds", reasoning: "Phytoestrogens support hormonal balance during this phase", isActive: true, priority: 4 },
      { phase: "follicular" as const, foodItem: "Quinoa", reasoning: "Complex carbs and protein for sustained energy", isActive: true, priority: 5 },

      // Ovulation
      { phase: "ovulation" as const, foodItem: "Berries", reasoning: "Antioxidants support the body during peak fertility", isActive: true, priority: 1 },
      { phase: "ovulation" as const, foodItem: "Whole Grains", reasoning: "Fiber helps maintain stable blood sugar during hormonal peak", isActive: true, priority: 2 },
      { phase: "ovulation" as const, foodItem: "Cruciferous Vegetables", reasoning: "Broccoli and cauliflower support estrogen metabolism", isActive: true, priority: 3 },
      { phase: "ovulation" as const, foodItem: "Lean Protein", reasoning: "Supports the body during its most metabolically active phase", isActive: true, priority: 4 },

      // Luteal
      { phase: "luteal" as const, foodItem: "Sweet Potatoes", reasoning: "Complex carbs help with serotonin production, improving mood", isActive: true, priority: 1 },
      { phase: "luteal" as const, foodItem: "Pumpkin Seeds", reasoning: "Magnesium and zinc support progesterone production", isActive: true, priority: 2 },
      { phase: "luteal" as const, foodItem: "Turkey", reasoning: "Tryptophan helps with sleep and mood regulation", isActive: true, priority: 3 },
      { phase: "luteal" as const, foodItem: "Avocado", reasoning: "Healthy fats support hormone production; potassium reduces bloating", isActive: true, priority: 4 },
      { phase: "luteal" as const, foodItem: "Chamomile Tea", reasoning: "Calming properties help with pre-menstrual anxiety and sleep", isActive: true, priority: 5 },
      { phase: "luteal" as const, foodItem: "Walnuts", reasoning: "Omega-3s and magnesium help manage PMS symptoms", isActive: true, priority: 6 },
    ];

    for (const tip of tips) {
      await ctx.db.insert("nutritionTips", tip);
    }

    return `Seeded ${tips.length} nutrition tips`;
  },
});
