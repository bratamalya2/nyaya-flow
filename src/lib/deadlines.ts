export type DeadlineRule = { daysAfter: number; businessDays: boolean; excludedWeekdays?: number[] };

/** Calendar calculation used only for explicitly configured firm rule packs. It does not claim court-law coverage. */
export function calculateDeadline(triggerOn: string, rule: DeadlineRule) {
  const date = new Date(`${triggerOn}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) throw new Error("Invalid trigger date.");
  const excluded = new Set(rule.excludedWeekdays ?? []);
  let remaining = rule.daysAfter;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (!rule.businessDays || (!excluded.has(date.getUTCDay()) && date.getUTCDay() !== 0 && date.getUTCDay() !== 6)) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}
