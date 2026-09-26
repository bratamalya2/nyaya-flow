export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

type ErrorBody = { error?: string; correlationId?: string; issues?: { fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] } };

function describe(body: ErrorBody) {
  const field = Object.values(body.issues?.fieldErrors ?? {}).flat().find(Boolean);
  return field || body.issues?.formErrors?.[0] || body.error || "Request failed.";
}

/** Browser-side JSON call to the application API with readable error messages. */
export async function callApi<T = unknown>(url: string, options: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: describe(body), status: response.status };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again.", status: 0 };
  }
}

/** Combines a date (YYYY-MM-DD) and time (HH:MM) entered in IST into an ISO timestamp. */
export const istDateTime = (date: string, time: string) => `${date}T${time}:00+05:30`;

const istParts = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", ...options }).format(new Date(value));
export const istDateInput = (value: string) => istParts(value, { year: "numeric", month: "2-digit", day: "2-digit" });
export const istTimeInput = (value: string) => istParts(value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const todayIst = () => istDateInput(new Date().toISOString());

/**
 * Submit handler that keeps the user's input on failure. React 19 resets uncontrolled fields after a
 * `<form action>` finishes, which would wipe a form whose request was rejected.
 */
export function submitWith(handler: (data: FormData) => unknown) {
  return (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    void handler(new FormData(event.currentTarget));
  };
}
