export type MobileRole = "primary" | "partner";
export type PeriodCertainty = "exact" | "approximate";

export function getCertaintyChoiceStyle(
  selected: boolean,
  palette: { accent: string; border: string; glass: string; highlight: string },
): { backgroundColor: string; borderColor: string; borderWidth: number } {
  return {
    backgroundColor: selected ? palette.highlight : palette.glass,
    borderColor: selected ? palette.accent : palette.border,
    borderWidth: selected ? 2 : 1,
  };
}

export function getCycleSetupFailureMessage(settingsSaved: boolean): string {
  return settingsSaved
    ? "Your cycle settings are saved. We couldn’t confirm that your period start date was saved. Retry to finish setup."
    : "We couldn’t confirm which setup changes were saved. Check your connection and retry.";
}

export const DEFAULT_CYCLE_LENGTH = 28;
export const MIN_CYCLE_LENGTH = 21;
export const MAX_CYCLE_LENGTH = 40;
export const DEFAULT_PERIOD_LENGTH = 5;
export const MIN_PERIOD_LENGTH = 2;
export const MAX_PERIOD_LENGTH = 8;

export function getDeviceDate(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function hasInitialPeriod(
  periods: readonly { startDate: string }[] | undefined,
): boolean {
  return (periods?.length ?? 0) > 0;
}

export async function saveInitialCycleSetup({
  startDate,
  startCertainty,
  cycleLength,
  periodLength,
  timeZone,
  existingPeriods,
  logPeriodStart,
  updateCycleSettings,
  onSettingsSaved,
}: {
  startDate: string;
  startCertainty: PeriodCertainty;
  cycleLength: number;
  periodLength: number;
  timeZone: string | null;
  existingPeriods: readonly { startDate: string; certainty?: string }[];
  logPeriodStart: (args: {
    startDate: string;
    startCertainty: PeriodCertainty;
    timeZone: string;
  }) => Promise<unknown>;
  updateCycleSettings: (args: {
    cycleLength: number;
    periodLength: number;
  }) => Promise<unknown>;
  onSettingsSaved?: () => void;
}): Promise<void> {
  if (!startDate) throw new Error("Choose when your last period started.");
  if (!timeZone) throw new Error("A device time zone is required to continue.");
  if (!Number.isInteger(cycleLength) || cycleLength < MIN_CYCLE_LENGTH || cycleLength > MAX_CYCLE_LENGTH) {
    throw new Error(`Cycle length must be between ${MIN_CYCLE_LENGTH} and ${MAX_CYCLE_LENGTH} days.`);
  }
  if (!Number.isInteger(periodLength) || periodLength < MIN_PERIOD_LENGTH || periodLength > MAX_PERIOD_LENGTH) {
    throw new Error(`Period length must be between ${MIN_PERIOD_LENGTH} and ${MAX_PERIOD_LENGTH} days.`);
  }

  // Save settings first so any persisted period is proof that both setup writes
  // completed. If the period write fails, onboarding remains available and the
  // settings query can restore the saved values on the next launch.
  await updateCycleSettings({ cycleLength, periodLength });
  onSettingsSaved?.();

  const alreadySaved = existingPeriods.some((period) => period.startDate === startDate);
  if (!alreadySaved) {
    await logPeriodStart({ startDate, startCertainty, timeZone });
  }
}

export function isMobileRole(value: unknown): value is MobileRole {
  return value === "primary" || value === "partner";
}

export function getDeviceTimeZone(): string | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    new Intl.DateTimeFormat("en", { timeZone });
    return timeZone || null;
  } catch {
    return null;
  }
}

export async function saveOnboardingRole({
  role,
  currentRole,
  timeZone,
  ensureUser,
  updateRole,
  updateTimeZone,
}: {
  role: unknown;
  currentRole: string | undefined;
  timeZone: string | null;
  ensureUser: () => Promise<unknown>;
  updateRole: (args: { role: MobileRole }) => Promise<unknown>;
  updateTimeZone: (args: { timeZone: string }) => Promise<unknown>;
}): Promise<MobileRole> {
  if (!isMobileRole(role) || (currentRole && currentRole !== role)) {
    throw new Error("Role selection is unavailable.");
  }
  if (!timeZone) throw new Error("A device time zone is required to continue.");

  await ensureUser();
  await updateTimeZone({ timeZone });
  await updateRole({ role });
  return role;
}
