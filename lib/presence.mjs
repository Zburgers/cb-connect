export const HEARTBEAT_INTERVAL_MS = 10_000;
export const PRESENCE_TIMEOUT_MS = 25_000;
export const PRESENCE_REFRESH_MS = 1_000;

export function isPresentAt(lastSeen, now = Date.now()) {
  return Number.isFinite(lastSeen) && now < lastSeen + PRESENCE_TIMEOUT_MS;
}
