export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return formatLocalDateOnly(date) === value ? date : null;
}

export function formatLocalDateOnly(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}
