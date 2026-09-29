export function pairingCodePatternForLength(length?: string): RegExp {
  if (length === "6") return /^\d{6}$/;
  if (length === "12") return /^[0-9A-HJKMNP-TV-Z]{12}$/;
  return /^(?:\d{6}|[0-9A-HJKMNP-TV-Z]{12})$/;
}
