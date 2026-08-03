"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getLocalTimeZone, toLocalDateString } from "@/lib/utils";
import { Calendar, ArrowRight, Heart } from "lucide-react";

type Step = "role" | "period" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const updateRole = useMutation(api.mutations.users.updateUserRole);
  const logPeriodStart = useMutation(api.mutations.periods.logPeriodStart);
  const updateCycleSettings = useMutation(api.mutations.periods.updateCycleSettings);

  const [step, setStep] = useState<Step>("role");
  const [selectedRole, setSelectedRole] = useState<"primary" | "partner" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Period setup state
  const [lastPeriodDate, setLastPeriodDate] = useState("");
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);

  const handleSelectRole = async (role: "primary" | "partner") => {
    setSelectedRole(role);
    setError("");
    setIsSubmitting(true);
    try {
      await updateRole({ role });
      if (role === "primary") {
        setStep("period");
      } else {
        // Partner role — go straight to dashboard/partner to enter pairing code
        router.push("/dashboard/partner");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePeriodSetup = async () => {
    if (!lastPeriodDate) return;
    setError("");
    setIsSubmitting(true);
    try {
      await logPeriodStart({
        startDate: lastPeriodDate,
        timeZone: getLocalTimeZone(),
      });
      await updateCycleSettings({ cycleLength, periodLength });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleSkipPeriod = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Ambient blobs */}
      <div className="fixed inset-0 dark:block hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            CB Connect
          </h1>
          {step === "role" && (
            <>
              <p className="mt-3 text-lg font-semibold text-foreground">Welcome! How will you use this app?</p>
              <p className="mt-1 text-sm text-muted-foreground">This helps us show you the right features.</p>
            </>
          )}
          {step === "period" && (
            <>
              <p className="mt-3 text-lg font-semibold text-foreground">Set up your cycle</p>
              <p className="mt-1 text-sm text-muted-foreground">This helps us give you accurate predictions.</p>
            </>
          )}
        </div>

        {/* Step indicator */}
        {step === "period" && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary/30" />
            <div className="w-2 h-2 rounded-full bg-primary" />
          </div>
        )}
        {step === "role" && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <div className="w-2 h-2 rounded-full bg-primary/30" />
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 text-red-500 dark:text-red-400 rounded-xl text-sm border border-red-500/20 text-center">
            {error}
          </div>
        )}

        {/* Step: role selection */}
        {step === "role" && (
          <div className="grid gap-4">
            <button
              onClick={() => handleSelectRole("primary")}
              disabled={isSubmitting}
              className="glass-card rounded-3xl p-6 text-left hover:ring-2 hover:ring-primary/50 transition-all duration-200 press-feedback disabled:opacity-50 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0 text-2xl group-hover:scale-105 transition-transform">
                  🌸
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">I track my cycle</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Log your period, pain, and symptoms. Share insights with your partner.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleSelectRole("partner")}
              disabled={isSubmitting}
              className="glass-card rounded-3xl p-6 text-left hover:ring-2 hover:ring-secondary/50 transition-all duration-200 press-feedback disabled:opacity-50 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center flex-shrink-0 text-2xl group-hover:scale-105 transition-transform">
                  💙
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">I support my partner</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect with your partner's app to see their cycle phase and how to support them.
                  </p>
                </div>
              </div>
            </button>

            {isSubmitting && (
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                Setting up your account…
              </p>
            )}
          </div>
        )}

        {/* Step: period setup (primary only) */}
        {step === "period" && (
          <div className="space-y-6">
            <div className="glass-card rounded-3xl p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  When did your last period start?
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <input
                    type="date"
                    value={lastPeriodDate}
                    onChange={(e) => setLastPeriodDate(e.target.value)}
                    max={toLocalDateString()}
                    className="w-full pl-12 pr-4 py-4 bg-muted border border-border rounded-2xl text-foreground
                      focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                      transition-all touch-target"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Average cycle length: <span className="text-primary font-semibold">{cycleLength} days</span>
                </label>
                <input
                  type="range"
                  min="21"
                  max="40"
                  value={cycleLength}
                  onChange={(e) => setCycleLength(parseInt(e.target.value))}
                  className="w-full h-3 bg-muted rounded-full appearance-none cursor-pointer accent-primary touch-target"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>21 days</span>
                  <span>28 days</span>
                  <span>40 days</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Average period length: <span className="text-primary font-semibold">{periodLength} days</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="8"
                  value={periodLength}
                  onChange={(e) => setPeriodLength(parseInt(e.target.value))}
                  className="w-full h-3 bg-muted rounded-full appearance-none cursor-pointer accent-primary touch-target"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>2 days</span>
                  <span>5 days</span>
                  <span>8 days</span>
                </div>
              </div>
            </div>

            <button
              onClick={handlePeriodSetup}
              disabled={isSubmitting || !lastPeriodDate}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold
                hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all
                press-feedback no-tap-highlight touch-target shadow-lg shadow-primary/30
                flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                "Setting up…"
              ) : (
                <>
                  Start Tracking
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button
              onClick={handleSkipPeriod}
              disabled={isSubmitting}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
