export function normalizePairingCode(value: string): string | null {
  const code = value.trim().replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{6}(?:[A-Z0-9]{6})?$/.test(code) ? code : null;
}

export function normalizeNickname(value: string): string | null {
  const nickname = value.trim().replace(/\s+/g, " ");
  return nickname.length <= 40 ? nickname : null;
}

export type PairingCode = { code: string; expiresAt: number };

export function getFreshPairingCode(
  generatedCode: PairingCode | null,
  serverCode: PairingCode | null | undefined,
  now: number,
): PairingCode | null {
  if (generatedCode && generatedCode.expiresAt > now) return generatedCode;
  if (serverCode && serverCode.expiresAt > now) return serverCode;
  return null;
}

export type PartnerDrafts = { connectedSinceDate: string; partnerNickname: string };

export function syncPartnerDrafts(
  drafts: PartnerDrafts,
  update: Partial<PartnerDrafts>,
): PartnerDrafts {
  return { ...drafts, ...update };
}
