/**
 * Cover art upload to R2. Signed-in wallets only; images only, 4 MB max.
 * The file's magic bytes must match its declared type.
 */
import {
	assertSameOrigin,
	errorResponse,
	jsonResponse,
	mediaUrl,
	nowSeconds,
	requireWallet,
	services,
} from "../lib/.server/context.js";
import { insertUpload } from "../lib/.server/db.js";
import { originFor } from "../lib/.server/env.js";
import type { Route } from "./+types/api.uploads";

const MAX_BYTES = 4 * 1024 * 1024;

const SIGNATURES: readonly Readonly<{
	type: string;
	ext: string;
	matches: (bytes: Uint8Array) => boolean;
}>[] = [
	{
		type: "image/png",
		ext: "png",
		matches: (b) =>
			b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
	},
	{
		type: "image/jpeg",
		ext: "jpg",
		matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
	},
	{
		type: "image/gif",
		ext: "gif",
		matches: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
	},
	{
		type: "image/webp",
		ext: "webp",
		matches: (b) =>
			b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
			b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
	},
];

export async function action({ request, context }: Route.ActionArgs) {
	assertSameOrigin(request);

	const app = services(context);
	const wallet = await requireWallet(app, request);
	const length = Number(request.headers.get("Content-Length") ?? "0");

	if (length > MAX_BYTES + 64 * 1024) {
		return errorResponse(413, "Images must be 4 MB or smaller");
	}

	const form = await request.formData();
	const file = form.get("file");

	if (!(file instanceof File)) return errorResponse(400, "Choose an image");

	if (file.size > MAX_BYTES) {
		return errorResponse(413, "Images must be 4 MB or smaller");
	}

	const bytes = new Uint8Array(await file.arrayBuffer());
	const kind = SIGNATURES.find((signature) => signature.matches(bytes));

	if (!kind) return errorResponse(415, "Use a PNG, JPEG, WebP, or GIF image");

	const key = `c-${crypto.randomUUID()}.${kind.ext}`;

	await app.media.put(key, bytes, {
		httpMetadata: {
			contentType: kind.type,
			cacheControl: "public, max-age=31536000, immutable",
		},
	});
	await insertUpload(app.db, {
		key,
		owner: wallet,
		contentType: kind.type,
		size: bytes.length,
	}, nowSeconds());

	return jsonResponse({
		key,
		url: mediaUrl(originFor(app.config, request), key),
	});
}
