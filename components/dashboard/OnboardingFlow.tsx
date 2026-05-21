"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { useUser } from "@clerk/nextjs";
import { User, Heart, Calendar, Check, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { toLocalDateString } from "@/lib/utils";
// Note: by the time OnboardingFlow renders, ensureUser has already run in the layout,
// so `me` is guaranteed to exist. createOrUpdateUser is not needed here.

type Step = "role" | "period" | "done";

export default function OnboardingFlow() {
  const router = useRouter();
  const { isLoaded } = useUser();
  const me = useQuery(api.queries.users.getMe, isLoaded ? {} : "skip");
  const updateRole = useMutation(api.mutations.users.updateUserRole);
  const logPeriodStart = useMutation(api.mutations.periods.logPeriodStart);
  const updateCycleSettings = useMutation(api.mutations.periods.updateCycleSettings);

  const [step, setStep] = useState<Step>(me ? (me.role === "primary" ? "period" : "done") : "role");
  const [selectedRole, setSelectedRole] = useState<"primary" | "partner">("primary");
  const [lastPeriodDate, setLastPeriodDate] = useState("");
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoaded || me === undefined) {
    return <LoadingSpinner />;
  }

  const handleRoleSelect = async () => {
    setIsSubmitting(true);
    try {
      await updateRole({ role: selectedRole });

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
      <div className="text-center py-12 space-y-6 animate-slide-up">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 dark:bg-primary/20 flex items-center
          justify-center">
          <Check className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">You're all set!</h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            {selectedRole === "partner"
              ? "Ask your partner for their pairing code to link accounts."
              : "Your dashboard is being prepared..."}
          </p>
        </div>
        {selectedRole === "partner" && (
          <div className="pt-4">
            <button
              onClick={() => router.push("/dashboard/partner")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground
                rounded-2xl font-semibold hover:bg-secondary/90 transition-all press-feedback
                no-tap-highlight touch-target shadow-lg shadow-secondary/30"
            >
              <Heart className="w-5 h-5" />
              <span>Already have a pairing code?</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-xs text-muted-foreground mt-3">
              Enter your partner's 6-digit code to link accounts
            </p>
          </div>
        )}
      </div>
    );
  }

  if (step === "role") {
    return (
      <div className="max-w-md mx-auto py-12 space-y-8 animate-slide-up">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Welcome to CB Connect</h2>
          <p className="text-muted-foreground mt-2">How will you be using this app?</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setSelectedRole("primary")}
            type="button"
            className={`w-full p-6 rounded-3xl border-2 text-left transition-all press-feedback 
              no-tap-highlight touch-target
              ${selectedRole === "primary"
                ? "border-primary bg-primary/5 dark:bg-primary/10"
                : "border-input hover:border-primary/50 hover:bg-muted/30"
              }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center
                ${selectedRole === "primary" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
                }`}>
                <User className="w-7 h-7" />
              </div>
              <div>
                <p className="font-semibold text-foreground">I'm tracking my cycle</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Log periods, track pain, and get personalized tips
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setSelectedRole("partner")}
            type="button"
            className={`w-full p-6 rounded-3xl border-2 text-left transition-all press-feedback 
              no-tap-highlight touch-target
              ${selectedRole === "partner"
                ? "border-primary bg-primary/5 dark:bg-primary/10"
                : "border-input hover:border-primary/50 hover:bg-muted/30"
              }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center
                ${selectedRole === "partner" 
                  ? "bg-secondary text-secondary-foreground" 
                  : "bg-muted text-muted-foreground"
                }`}>
                <Heart className="w-7 h-7" />
              </div>
              <div>
                <p className="font-semibold text-foreground">I'm a supportive partner</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Stay informed and know how to support your partner
                </p>
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={handleRoleSelect}
          disabled={isSubmitting}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold 
            hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all 
            press-feedback no-tap-highlight touch-target shadow-lg shadow-primary/30"
        >
          {isSubmitting ? "Setting up..." : "Continue"}
        </button>
      </div>
    );
  }

  // Step: period setup (primary only)
  return (
    <div className="max-w-md mx-auto py-12 space-y-8 animate-slide-up">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Initial Setup</h2>
        <p className="text-muted-foreground mt-2">Let's set up your cycle tracking</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            When did your last period start?
          </label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="date"
              value={lastPeriodDate}
              onChange={(e) => setLastPeriodDate(e.target.value)}
              max={toLocalDateString()}
              className="w-full pl-12 pr-4 py-4 bg-muted/50 border border-input rounded-2xl 
                focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary 
                transition-all touch-target"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Average cycle length: <span className="text-primary">{cycleLength}</span> days
          </label>
          <input
            type="range"
            min="21"
            max="40"
            value={cycleLength}
            onChange={(e) => setCycleLength(parseInt(e.target.value))}
            className="w-full h-3 bg-muted rounded-full appearance-none cursor-pointer accent-primary 
              touch-target"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>21</span>
            <span>28</span>
            <span>40</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Average period length: <span className="text-primary">{periodLength}</span> days
          </label>
          <input
            type="range"
            min="2"
            max="8"
            value={periodLength}
            onChange={(e) => setPeriodLength(parseInt(e.target.value))}
            className="w-full h-3 bg-muted rounded-full appearance-none cursor-pointer accent-primary 
              touch-target"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>2</span>
            <span>5</span>
            <span>8</span>
          </div>
        </div>
      </div>

      <button
        onClick={handlePeriodSetup}
        disabled={isSubmitting || !lastPeriodDate}
        className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold 
          hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all 
          press-feedback no-tap-highlight touch-target shadow-lg shadow-primary/30"
      >
        {isSubmitting ? "Setting up..." : "Start Tracking"}
      </button>
    </div>
  );
}
