/**
 * Request helpers shared by loaders, actions, and resource routes.
 */
import type { AppLoadContext } from "react-router";

import { currentWallet } from "./auth.js";
import { readServerConfig, type ServerConfig, type WorkerEnv } from "./env.js";

export type AppServices = Readonly<{
	env: WorkerEnv;
	config: ServerConfig;
	db: D1Database;
	media: R2Bucket;
	waitUntil: (promise: Promise<unknown>) => void;
}>;

export function services(context: AppLoadContext): AppServices {
	const { env, ctx } = context.cloudflare;

	return {
		env,
		config: readServerConfig(env),
		db: env.DB,
		media: env.MEDIA,
		waitUntil: (promise) => ctx.waitUntil(promise),
	};
}

export function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

export function jsonResponse(
	data: unknown,
	init: ResponseInit = {},
): Response {
	const headers = new Headers(init.headers);

	headers.set("Content-Type", "application/json; charset=utf-8");

	if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");

	return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(status: number, message: string): Response {
	return jsonResponse({ error: message }, { status });
}

/**
 * Security: reject cross-site writes. Session cookies are `SameSite=Lax`,
 * and every mutating endpoint also requires a same-origin `Origin` header.
 */
export function assertSameOrigin(request: Request): void {
	const origin = request.headers.get("Origin");

	if (origin !== new URL(request.url).origin) {
		throw errorResponse(403, "Cross-site request refused");
	}
}

/** The signed-in wallet, or a 401 response thrown to the caller. */
export async function requireWallet(
	app: AppServices,
	request: Request,
): Promise<string> {
	const wallet = await currentWallet(app.db, request, nowSeconds());

	if (!wallet) throw errorResponse(401, "Sign in with your wallet first");

	return wallet;
}

/** Parse a JSON body with a size cap; throws a 400 response on failure. */
export async function readJson(
	request: Request,
	maxBytes = 64 * 1024,
): Promise<unknown> {
	const text = await request.text();

	if (text.length > maxBytes) throw errorResponse(413, "Request too large");

	if (!text) throw errorResponse(400, "Expected a JSON body");

	try {
		return JSON.parse(text);
	} catch {
		throw errorResponse(400, "Malformed JSON");
	}
}

/** Public URL for an uploaded image key. */
export function mediaUrl(origin: string, key: string | null): string | null {
	return key ? `${origin}/media/${key}` : null;
}
