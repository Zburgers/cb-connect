"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GlassPanel from "@/components/common/GlassPanel";
import { Bell, BellOff, Eye, EyeOff, HandHeart, Lock, Shield } from "lucide-react";

const GENDER_OPTIONS = [
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
] as const;

const PARTNER_TYPE_OPTIONS = [
  { value: "partner", label: "Partner" },
  { value: "boyfriend", label: "Boyfriend" },
  { value: "girlfriend", label: "Girlfriend" },
  { value: "spouse", label: "Spouse" },
  { value: "other", label: "Other" },
] as const;

export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const cycleSettings = useQuery(
    api.queries.history.getCycleSettings,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const coupleStatus = useQuery(
    api.queries.couples.getCoupleStatus,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const me = useQuery(api.queries.users.getMe, isLoaded && isSignedIn ? {} : "skip");
  const notificationLog = useQuery(
    api.queries.users.getMyNotificationLog,
    isLoaded && isSignedIn ? { limit: 5 } : "skip"
  );
  const updateSettings = useMutation(api.mutations.periods.updateCycleSettings);
  const updatePreferences = useMutation(api.mutations.users.updateUserPreferences);

  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [predictionPaused, setPredictionPaused] = useState(false);
  const [preferredName, setPreferredName] = useState("");
  const [gender, setGender] =
    useState<(typeof GENDER_OPTIONS)[number]["value"]>("prefer_not_to_say");
  const [partnerType, setPartnerType] =
    useState<(typeof PARTNER_TYPE_OPTIONS)[number]["value"]>("partner");
  const [externalNotificationConsent, setExternalNotificationConsent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (cycleSettings) {
      setCycleLength(cycleSettings.cycleLength);
      setPeriodLength(cycleSettings.periodLength);
      setPredictionPaused(cycleSettings.predictionPaused ?? false);
    }
  }, [cycleSettings]);

  useEffect(() => {
    if (me) {
      setPreferredName(me.preferredName ?? "");
      setGender(me.gender ?? "prefer_not_to_say");
      setPartnerType(me.partnerType ?? "partner");
      setExternalNotificationConsent(me.externalNotificationConsent ?? false);
    }
  }, [me]);

  if (
    !isLoaded ||
    cycleSettings === undefined ||
    coupleStatus === undefined ||
    me === undefined ||
    me === null ||
    notificationLog === undefined
  ) {
    return <LoadingSpinner />;
  }

  const isLinked = Boolean(coupleStatus?.isLinked);
  const isPrimary = me.role === "primary";
  const phaseShared = Boolean(isLinked && coupleStatus?.sharingSettings?.phase);
  const painShared = Boolean(isLinked && coupleStatus?.sharingSettings?.pain);
  const periodWriteAllowed = Boolean(
    isLinked && coupleStatus?.sharingSettings?.periodWrite
  );

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      if (isPrimary) {
        await updateSettings({ cycleLength, periodLength, predictionPaused });
      }
      await updatePreferences({
        preferredName,
        gender,
        partnerType,
        externalNotificationConsent,
      });
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
        <p className="text-sm text-muted-foreground">Manage your cycle preferences and sharing states</p>
      </div>

      <GlassPanel variant="quiet" className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Privacy snapshot
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
              Partner visibility
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              These states mirror the sharing toggles in the partner screen. They are shown
              here so you can quickly tell what is private and what is visible.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/[0.42] px-3 py-2 text-xs font-semibold text-foreground dark:border-white/10 dark:bg-white/[0.07]">
            <Shield className="h-4 w-4 text-primary" />
            {isLinked ? "Linked couple" : "Not linked"}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="contrast-glass rounded-[1.4rem] p-4">
            <div className="flex items-center gap-2">
              {phaseShared ? (
                <Eye className="h-4 w-4 text-primary" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              <p className="text-sm font-semibold text-foreground">Period history</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {phaseShared
                ? "Visible to your partner on the log page."
                : isLinked
                  ? "Kept private until sharing is turned on."
                  : "No partner is linked yet."}
            </p>
          </div>

          <div className="contrast-glass rounded-[1.4rem] p-4">
            <div className="flex items-center gap-2">
              {periodWriteAllowed ? (
                <HandHeart className="h-4 w-4 text-primary" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              <p className="text-sm font-semibold text-foreground">
                Partner-assisted logging
              </p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {periodWriteAllowed
                ? me.role === "primary"
                  ? "Your partner can help add period start/end dates."
                  : "You can help add period start/end dates for your partner."
                : isLinked
                  ? me.role === "primary"
                    ? "Only you can log period dates."
                    : "Only your partner can log period dates."
                  : "No partner is linked yet."}
            </p>
          </div>

          <div className="contrast-glass rounded-[1.4rem] p-4">
            <div className="flex items-center gap-2">
              {painShared ? (
                <Eye className="h-4 w-4 text-primary" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              <p className="text-sm font-semibold text-foreground">Pain history</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {painShared
                ? "Visible to your partner on the log page."
                : isLinked
                  ? "Kept private until sharing is turned on."
                  : "No partner is linked yet."}
            </p>
          </div>
        </div>
      </GlassPanel>

      {isPrimary && (
        <GlassPanel variant="quiet" className="space-y-6 p-6">
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

          <label className="flex items-start gap-3 rounded-2xl border border-white/50 bg-white/[0.42] p-4 dark:border-white/10 dark:bg-white/[0.07]">
            <input
              type="checkbox"
              checked={predictionPaused}
              onChange={(event) => setPredictionPaused(event.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Pause cycle predictions
              </span>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                Pause estimated cycle guidance until you turn it back on. Recorded period
                history remains available.
              </span>
            </span>
          </label>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
          </button>
        </GlassPanel>
      )}

      <GlassPanel variant="quiet" className="space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Personalization</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These optional fields keep partner copy inclusive and avoid assumptions.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-foreground">
              Preferred name
            </span>
            <input
              type="text"
              value={preferredName}
              onChange={(event) => setPreferredName(event.target.value.slice(0, 40))}
              placeholder={me?.name || "What should your partner see?"}
              className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="mt-2 block text-xs leading-5 text-muted-foreground">
              Your partner sees this name in chat if they have not set a private nickname for you.
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-foreground">Gender</span>
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value as typeof gender)}
              className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-foreground">
              Relationship term
            </span>
            <select
              value={partnerType}
              onChange={(event) => setPartnerType(event.target.value as typeof partnerType)}
              className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {PARTNER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-white/50 bg-white/[0.42] p-4 dark:border-white/10 dark:bg-white/[0.07]">
          <input
            type="checkbox"
            checked={externalNotificationConsent}
            onChange={(event) => setExternalNotificationConsent(event.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {externalNotificationConsent ? (
                <Bell className="h-4 w-4 text-primary" />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              )}
              Allow external notification delivery
            </span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              When enabled, CB Connect may send redacted care-event alerts through the configured external webhook.
            </span>
          </span>
        </label>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : saved ? "Saved!" : "Save Preferences"}
        </button>
      </GlassPanel>

      <GlassPanel variant="quiet" className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Notification history</h2>
            <p className="text-sm text-muted-foreground">
              Recent in-app and external notification activity, with sensitive payloads redacted.
            </p>
          </div>
          <Bell className="h-5 w-5 text-muted-foreground" />
        </div>

        {notificationLog.length > 0 ? (
          <div className="mt-4 space-y-3">
            {notificationLog.map((entry) => (
              <div
                key={entry._id}
                className="rounded-2xl border border-white/50 bg-white/[0.42] p-4 text-sm dark:border-white/10 dark:bg-white/[0.07]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    {entry.type.replace(/_/g, " ")}
                  </span>
                  <span className={entry.status === "sent" ? "text-primary" : "text-destructive"}>
                    {entry.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(entry.sentAt).toLocaleString()}
                </p>
                {entry.errorMessage && (
                  <p className="mt-2 text-xs text-destructive">{entry.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No notification activity yet.
          </p>
        )}
      </GlassPanel>
    </div>
  );
}
