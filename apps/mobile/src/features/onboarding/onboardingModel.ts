export type MobileRole = "primary" | "partner";

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
