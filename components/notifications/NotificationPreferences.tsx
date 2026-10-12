"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";

import GlassPanel from "@/components/common/GlassPanel";
import { api } from "@/convex/_generated/api";
import type { notificationEventDefinitions } from "@/convex/_helpers/notificationTypes";

type NotificationPurpose =
  (typeof notificationEventDefinitions)[keyof typeof notificationEventDefinitions]["purpose"];
type ScheduledPurpose = "period_window_approaching";

type PreferenceOption = {
  purpose: NotificationPurpose;
  label: string;
  description: string;
  primaryOnly?: boolean;
  scheduled?: boolean;
};

const OPTIONS = [
  {
    purpose: "assisted_period_start",
    label: "Period start assistance",
    description:
      "A private confirmation when a period start is logged with partner assistance.",
    primaryOnly: true,
  },
  {
    purpose: "assisted_period_end",
    label: "Period end assistance",
    description:
      "A private confirmation when a period end is logged with partner assistance.",
    primaryOnly: true,
  },
  {
    purpose: "period_window_approaching",
    label: "Upcoming cycle window",
    description:
      "A private reminder based on your current served cycle estimate.",
    primaryOnly: true,
    scheduled: true,
  },
  {
    purpose: "pain_check_in",
    label: "Requested check-in",
    description: "A private reminder that you explicitly request.",
    primaryOnly: true,
  },
  {
    purpose: "partner_linked",
    label: "Connection updates",
    description: "In-app updates about changes to your connection.",
  },
  {
    purpose: "partner_message",
    label: "Message activity",
    description: "In-app activity notices for current chat messages.",
  },
  {
    purpose: "partner_nudge",
    label: "Nudge activity",
    description: "In-app notices when a partner sends a nudge.",
  },
  {
    purpose: "partner_chat_cleared",
    label: "Chat updates",
    description: "In-app notices when the shared chat is cleared.",
  },
  {
    purpose: "connected_since_updated",
    label: "Connection date updates",
    description: "In-app notices when the connection date setting changes.",
  },
] as const satisfies readonly PreferenceOption[];

const SCHEDULED_PURPOSES = new Set<ScheduledPurpose>([
  "period_window_approaching",
]);

export default function NotificationPreferences({
  role,
}: {
  role: "primary" | "partner";
}) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const preferences = useQuery(
    api.queries.notifications.getMyPreferences,
    isAuthenticated ? {} : "skip",
  );
  const setMyPreference = useMutation(
    api.mutations.notifications.setMyPreference,
  );
  const [draftTimes, setDraftTimes] = useState<
    Partial<Record<ScheduledPurpose, string>>
  >({});
  const [savingPurpose, setSavingPurpose] =
    useState<NotificationPurpose | null>(null);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  if (isLoading) {
    return (
      <GlassPanel variant="quiet" className="space-y-2 p-6">
        <h2 className="text-lg font-semibold text-foreground">
          In-app notification preferences
        </h2>
        <p
          className="text-sm text-foreground/75"
          role="status"
          aria-live="polite"
        >
          Loading notification preferences…
        </p>
      </GlassPanel>
    );
  }

  if (!isAuthenticated) {
    return (
      <GlassPanel variant="quiet" className="space-y-2 p-6">
        <h2 className="text-lg font-semibold text-foreground">
          In-app notification preferences
        </h2>
        <p className="text-sm text-foreground/75" role="status">
          Sign in to manage your notification preferences.
        </p>
      </GlassPanel>
    );
  }

  if (preferences === undefined) {
    return (
      <GlassPanel variant="quiet" className="space-y-2 p-6">
        <h2 className="text-lg font-semibold text-foreground">
          In-app notification preferences
        </h2>
        <p
          className="text-sm text-foreground/75"
          role="status"
          aria-live="polite"
        >
          Loading notification preferences…
        </p>
      </GlassPanel>
    );
  }

  const preferencesByPurpose = new Map(
    preferences.map((preference) => [preference.purpose, preference]),
  );
  const visibleOptions = OPTIONS.filter(
    (option) =>
      role === "primary" || !("primaryOnly" in option && option.primaryOnly),
  );

  async function savePreference(
    purpose: NotificationPurpose,
    inAppEnabled: boolean,
    localReminderTime?: string | null,
    operation: "toggle" | "save_time" = "toggle",
  ) {
    setSavingPurpose(purpose);
    setMessage("");
    setHasError(false);
    try {
      await setMyPreference({
        purpose,
        inAppEnabled,
        ...(localReminderTime === undefined ? {} : { localReminderTime }),
      });
      setMessage(
        operation === "save_time" || inAppEnabled
          ? "Notification preference saved."
          : "Preference turned off.",
      );
    } catch {
      setHasError(true);
    } finally {
      setSavingPurpose(null);
    }
  }

  return (
    <GlassPanel variant="quiet" className="p-6">
      <section
        aria-labelledby="notification-preferences-heading"
        className="space-y-5"
      >
        <div>
          <h2
            className="text-lg font-semibold text-foreground"
            id="notification-preferences-heading"
          >
            In-app notification preferences
          </h2>
          <p className="mt-1 text-sm leading-6 text-foreground/75">
            Choose which notices may appear in your private inbox. Each type
            starts off until you enable it. These settings do not change partner
            sharing.
          </p>
        </div>

        <div className="space-y-3">
          {visibleOptions.map((option) => {
            const preference = preferencesByPurpose.get(option.purpose);
            if (!preference) return null;

            const isScheduled = SCHEDULED_PURPOSES.has(
              option.purpose as ScheduledPurpose,
            );
            const savedTime = preference.localReminderTime ?? "";
            const reminderTime = isScheduled
              ? (draftTimes[option.purpose as ScheduledPurpose] ?? savedTime)
              : "";
            const timeChanged = isScheduled && reminderTime !== savedTime;
            const isSaving = savingPurpose === option.purpose;
            const checkboxId = `notification-${option.purpose}`;
            const timeId = `${checkboxId}-time`;

            return (
              <article
                key={option.purpose}
                className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-4"
              >
                <div className="flex items-start gap-3">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={preference.inAppEnabled}
                    disabled={
                      isSaving ||
                      (isScheduled &&
                        !preference.inAppEnabled &&
                        (timeChanged || !savedTime))
                    }
                    onChange={(event) =>
                      void savePreference(
                        option.purpose,
                        event.currentTarget.checked,
                        isScheduled ? savedTime || null : undefined,
                      )
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={checkboxId}
                      className="block cursor-pointer text-sm font-semibold text-foreground"
                    >
                      {option.label}
                    </label>
                    <p className="mt-1 text-sm leading-6 text-foreground/75">
                      {option.description}
                    </p>

                    {isScheduled && (
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                        <label htmlFor={timeId} className="block">
                          <span className="mb-1 block text-sm font-medium text-foreground">
                            Reminder time for {option.label.toLowerCase()}
                          </span>
                          <input
                            id={timeId}
                            type="time"
                            value={reminderTime}
                            disabled={isSaving}
                            onChange={(event) =>
                              setDraftTimes((current) => ({
                                ...current,
                                [option.purpose]: event.currentTarget.value,
                              }))
                            }
                            className="min-h-11 rounded-xl border border-border bg-muted px-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={
                            isSaving ||
                            !timeChanged ||
                            (preference.inAppEnabled && reminderTime === "")
                          }
                          onClick={() =>
                            void savePreference(
                              option.purpose,
                              preference.inAppEnabled,
                              reminderTime || null,
                              "save_time",
                            )
                          }
                          className="min-h-11 rounded-xl border border-foreground/15 px-4 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-[var(--color-glass-2)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Save {option.label.toLowerCase()} time
                        </button>
                      </div>
                    )}
                    {isScheduled && !savedTime && !preference.inAppEnabled && (
                      <p className="mt-2 text-xs leading-5 text-foreground/70">
                        Save a local reminder time before enabling this option.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {savingPurpose && (
          <p
            className="text-sm text-foreground/75"
            role="status"
            aria-live="polite"
          >
            Saving notification preference…
          </p>
        )}
        {message && (
          <p
            className="text-sm text-foreground/75"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        )}
        {hasError && (
          <p className="text-sm text-foreground" role="alert">
            Could not save this preference. Please try again.
          </p>
        )}
      </section>
    </GlassPanel>
  );
}
