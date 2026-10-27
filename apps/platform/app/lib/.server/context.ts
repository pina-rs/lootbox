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

/** Read at most maxBytes before parsing, including requests without a length. */
export async function readBody(
	request: Request,
	maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
	const reader = request.body?.getReader();
	const bytes = new Uint8Array(maxBytes);
	let size = 0;

	if (!reader) return new Uint8Array();

	try {
		while (true) {
			const { done, value } = await reader.read();

			if (done) break;

			if (value.byteLength > maxBytes - size) {
				try {
					await reader.cancel();
				} finally {
					throw errorResponse(413, "Request too large");
				}
			}

			bytes.set(value, size);
			size += value.byteLength;
		}
	} finally {
		reader.releaseLock();
	}

	return bytes.subarray(0, size);
}

/** Bound the complete encoded form before the multipart parser allocates files. */
export async function readFormData(
	request: Request,
	maxBytes: number,
): Promise<FormData> {
	const bytes = await readBody(request, maxBytes);

	try {
		return await new Response(bytes, { headers: request.headers }).formData();
	} catch {
		throw errorResponse(400, "Malformed form data");
	}
}

/** Parse bounded JSON; malformed bodies throw a 400 response. */
export async function readJson(
	request: Request,
	maxBytes = 64 * 1024,
): Promise<unknown> {
	const bytes = await readBody(request, maxBytes);

	if (!bytes.length) throw errorResponse(400, "Expected a JSON body");

	try {
		return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	} catch {
		throw errorResponse(400, "Malformed JSON");
	}
}

/** Public URL for an uploaded image key. */
export function mediaUrl(origin: string, key: string | null): string | null {
	return key ? `${origin}/media/${key}` : null;
}
