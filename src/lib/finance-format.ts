/** Browser-safe finance helpers. Keep database access in finance.ts server-only. */
export function paiseToInr(paise: number | bigint) { return Number(paise) / 100; }
export function inrToPaise(value: number) { return Math.round(value * 100); }
export function formatInr(paise: number | bigint) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paiseToInr(paise)); }
export function availableAdvance(receivedPaise: number, allocatedPaise: number) { return Math.max(0, receivedPaise - allocatedPaise); }
export function invoiceBalance(totalPaise: number, paidPaise: number, creditedPaise = 0) { return Math.max(0, totalPaise - paidPaise - creditedPaise); }
