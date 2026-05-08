"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";

export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const cycleSettings = useQuery(
    api.queries.history.getCycleSettings,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const updateSettings = useMutation(api.mutations.periods.updateCycleSettings);

  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (cycleSettings) {
      setCycleLength(cycleSettings.cycleLength);
      setPeriodLength(cycleSettings.periodLength);
    }
  }, [cycleSettings]);

  if (!isLoaded || cycleSettings === undefined) return <LoadingSpinner />;

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      await updateSettings({ cycleLength, periodLength });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your cycle preferences</p>
      </div>

      <div className="glass-card rounded-3xl p-6 space-y-6 animate-slide-up">
        <h2 className="text-lg font-semibold text-foreground">Cycle Settings</h2>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Average cycle length: {cycleLength} days
          </label>
          <input
            type="range"
            min="21"
            max="40"
            value={cycleLength}
            onChange={(e) => setCycleLength(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>21 days</span>
            <span>28 days</span>
            <span>40 days</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Average period length: {periodLength} days
          </label>
          <input
            type="range"
            min="2"
            max="8"
            value={periodLength}
            onChange={(e) => setPeriodLength(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>2 days</span>
            <span>5 days</span>
            <span>8 days</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isSaving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
