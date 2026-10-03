import { NextResponse } from "next/server";

import { RequestError } from "./router";

/**
 * Cross-site request guard for the mutating routes.
 *
 * The app binds to loopback and has no accounts, so there is nothing to log
 * into — but a page on any other site can still POST to 127.0.0.1 with the
 * browser's ambient cookies and write into her shelf. Browsers always attach
 * an `Origin` to a cross-site POST and never send one for a same-origin fetch,
 * so a missing Origin means a non-browser client (the daily timer, curl), and a
 * mismatched Origin means someone else's page.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin === null) return;
  const host = request.headers.get("host");
  if (host === null) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new RequestError("bad request: unparseable Origin header");
  }
  if (originHost !== host) {
    throw new RequestError(`bad request: cross-origin request from ${origin} refused`);
  }
}

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/** One error shape for every route, so the client has a single branch. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof RequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: `internal: ${message}` }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new RequestError("bad request: body is not valid JSON");
  }
}