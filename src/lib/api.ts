import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { z } from "zod";
import { recordAudit, type AuditInput } from "@/lib/audit";
import { withActor } from "@/lib/db";
import { isDemoMode } from "@/lib/runtime";
import type { AppRole } from "@/lib/types";
import { getWorkspace, type Workspace } from "@/lib/workspace";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RouteContext<P> {
  params: P;
  workspace: Workspace;
  correlationId: string;
  /** Runs the operation as the signed-in user under RLS, inside one transaction. */
  db: <T>(operation: (client: PoolClient) => Promise<T>) => Promise<T>;
  /** Records an audit event in the active organization with this request's correlation ID. */
  audit: (client: PoolClient, event: Omit<AuditInput, "organizationId" | "actorId" | "correlationId"> & { organizationId?: string }) => Promise<void>;
}

interface RouteOptions {
  /** Response used in demo mode; defaults to a 409 explaining that nothing is persisted. */
  demo?: (request: Request) => Response | Promise<Response>;
  /** Application roles allowed to call the route in the active organization. */
  roles?: AppRole[];
}

const PG_MESSAGES: Record<string, [number, string]> = {
  "23505": [409, "A record with these details already exists."],
  "23503": [400, "A referenced record does not exist in this organization."],
  "23514": [400, "The submitted values are outside the allowed range."],
  "22P02": [400, "The submitted data is invalid."],
  "22007": [400, "The submitted date is invalid."],
  "22008": [400, "The submitted date is invalid."],
  "42501": [403, "You do not have permission for this action."],
};

export function errorResponse(error: unknown, correlationId: string) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, correlationId }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "The submitted data is invalid.", issues: z.flattenError(error), correlationId }, { status: 400 });
  const code = (error as { code?: string } | null)?.code;
  // P0001/P0002 are raised by our own SQL functions with user-facing messages.
  if ((code === "P0001" || code === "P0002") && error instanceof Error) return NextResponse.json({ error: error.message, correlationId }, { status: 400 });
  if (code && PG_MESSAGES[code]) {
    const [status, message] = PG_MESSAGES[code];
    return NextResponse.json({ error: message, correlationId }, { status });
  }
  console.error(JSON.stringify({ level: "error", correlationId, code, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }));
  return NextResponse.json({ error: `Something went wrong. Quote reference ${correlationId} to support.`, correlationId }, { status: 500 });
}

export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const body = await request.json().catch(() => {
    throw new ApiError(400, "Request body must be JSON.");
  });
  return schema.parse(body);
}

export function apiRoute<P = Record<string, never>>(options: RouteOptions, handler: (request: Request, context: RouteContext<P>) => Promise<Response>) {
  return async (request: Request, segment: { params: Promise<P> }) => {
    const correlationId = crypto.randomUUID();
    try {
      if (isDemoMode()) return options.demo ? await options.demo(request) : NextResponse.json({ error: "Demo mode does not persist changes.", mode: "demo" }, { status: 409 });
      const workspace = await getWorkspace();
      if (!workspace) throw new ApiError(401, "Authentication required.");
      if (options.roles && !options.roles.includes(workspace.role)) throw new ApiError(403, "Your role does not permit this action.");
      const params = segment?.params ? await segment.params : ({} as P);
      const db = <T,>(operation: (client: PoolClient) => Promise<T>) => withActor(workspace.userId, operation);
      const audit: RouteContext<P>["audit"] = (client, event) => recordAudit(client, { ...event, organizationId: event.organizationId ?? workspace.organizationId, actorId: workspace.userId, correlationId });
      return await handler(request, { params, workspace, correlationId, db, audit });
    } catch (error) {
      return errorResponse(error, correlationId);
    }
  };
}

/** Public (pre-authentication) routes still get uniform error handling and correlation IDs. */
export function publicRoute<P = Record<string, never>>(handler: (request: Request, context: { params: P; correlationId: string }) => Promise<Response>) {
  return async (request: Request, segment: { params: Promise<P> }) => {
    const correlationId = crypto.randomUUID();
    try {
      const params = segment?.params ? await segment.params : ({} as P);
      return await handler(request, { params, correlationId });
    } catch (error) {
      return errorResponse(error, correlationId);
    }
  };
}

export const uuid = z.uuid();
export function assertUuid(value: string, label = "identifier") {
  if (!uuid.safeParse(value).success) throw new ApiError(404, `Unknown ${label}.`);
  return value;
}
