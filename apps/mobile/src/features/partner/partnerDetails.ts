export function normalizePairingCode(value: string): string | null {
  const code = value.trim().replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{6}(?:[A-Z0-9]{6})?$/.test(code) ? code : null;
}

export function normalizeNickname(value: string): string | null {
  const nickname = value.trim().replace(/\s+/g, " ");
  return nickname.length <= 40 ? nickname : null;
}
