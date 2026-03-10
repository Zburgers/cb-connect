"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";

type Step = "role" | "period" | "done";

export default function OnboardingFlow() {
  const { user: clerkUser } = useUser();
  const me = useQuery(api.queries.users.getMe);
  const createUser = useMutation(api.mutations.users.createOrUpdateUser);
  const updateRole = useMutation(api.mutations.users.updateUserRole);
  const logPeriodStart = useMutation(api.mutations.periods.logPeriodStart);
  const updateCycleSettings = useMutation(api.mutations.periods.updateCycleSettings);

  const [step, setStep] = useState<Step>(me ? (me.role === "primary" ? "period" : "done") : "role");
  const [selectedRole, setSelectedRole] = useState<"primary" | "partner">("primary");
  const [lastPeriodDate, setLastPeriodDate] = useState("");
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRoleSelect = async () => {
    setIsSubmitting(true);
    try {
      if (!me) {
        await createUser({
          clerkId: clerkUser?.id ?? "",
          email: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
          name: clerkUser?.fullName ?? "User",
          role: selectedRole,
        });
      } else {
        await updateRole({ role: selectedRole });
      }

      if (selectedRole === "primary") {
        setStep("period");
      } else {
        setStep("done");
      }
    } catch (error) {
      console.error("Failed to set role:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePeriodSetup = async () => {
    if (!lastPeriodDate) return;
    setIsSubmitting(true);
    try {
      await logPeriodStart({ startDate: lastPeriodDate });
      await updateCycleSettings({ cycleLength, periodLength });
      setStep("done");
      window.location.reload();
    } catch (error) {
      console.error("Failed to set up period:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "done") {
    return (
      <div className="text-center py-12 space-y-4">
        <span className="text-6xl">🎉</span>
        <h2 className="text-2xl font-bold text-gray-900">You're all set!</h2>
        <p className="text-gray-600">
          {selectedRole === "partner"
            ? "Ask your partner for their pairing code to link accounts."
            : "Your dashboard is being prepared..."}
        </p>
      </div>
    );
  }

  if (step === "role") {
    return (
      <div className="max-w-md mx-auto py-12 space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Welcome to CB Connect</h2>
          <p className="text-gray-600 mt-2">How will you be using this app?</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setSelectedRole("primary")}
            className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
              selectedRole === "primary"
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">🌸</span>
              <div>
                <p className="font-semibold text-gray-900">I'm tracking my cycle</p>
                <p className="text-sm text-gray-500 mt-1">
                  Log periods, track pain, and get personalized tips
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setSelectedRole("partner")}
            className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
              selectedRole === "partner"
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">💕</span>
              <div>
                <p className="font-semibold text-gray-900">I'm a supportive partner</p>
                <p className="text-sm text-gray-500 mt-1">
                  Stay informed and know how to support your partner
                </p>
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={handleRoleSelect}
          disabled={isSubmitting}
          className="w-full py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? "Setting up..." : "Continue"}
        </button>
      </div>
    );
  }

  // Step: period setup (primary only)
  return (
    <div className="max-w-md mx-auto py-12 space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Initial Setup</h2>
        <p className="text-gray-600 mt-2">Let's set up your cycle tracking</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            When did your last period start?
          </label>
          <input
            type="date"
            value={lastPeriodDate}
            onChange={(e) => setLastPeriodDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Average cycle length: {cycleLength} days
          </label>
          <input
            type="range"
            min="21"
            max="40"
            value={cycleLength}
            onChange={(e) => setCycleLength(parseInt(e.target.value))}
            className="w-full accent-primary-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>21</span>
            <span>28</span>
            <span>40</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Average period length: {periodLength} days
          </label>
          <input
            type="range"
            min="2"
            max="8"
            value={periodLength}
            onChange={(e) => setPeriodLength(parseInt(e.target.value))}
            className="w-full accent-primary-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>2</span>
            <span>5</span>
            <span>8</span>
          </div>
        </div>
      </div>

      <button
        onClick={handlePeriodSetup}
        disabled={isSubmitting || !lastPeriodDate}
        className="w-full py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? "Setting up..." : "Start Tracking"}
      </button>
    </div>
  );
}
