/**
 * Loopback Surfpool helpers for local development only: test SOL and the
 * emulator's reveal proof. Refused unless localnet is enabled against a
 * loopback control plane.
 */
import {
	assertSameOrigin,
	errorResponse,
	jsonResponse,
	readJson,
	services,
} from "../lib/.server/context.js";
import { localProof } from "../lib/.server/relayer.js";
import { addressSchema } from "../lib/schemas.js";
import type { Route } from "./+types/api.local";

export async function loader({ request, params, context }: Route.LoaderArgs) {
	const { config } = services(context);
	const control = config.localnetControlUrl;

	if (!control || params.action !== "proof") {
		return errorResponse(404, "Not found");
	}

	const randomness = addressSchema.safeParse(
		new URL(request.url).searchParams.get("randomness"),
	);

	if (!randomness.success) return errorResponse(400, "Bad randomness address");

	const proof = await localProof(control, randomness.data);

	return jsonResponse({
		signature: Array.from(proof.signature),
		recoveryId: proof.recoveryId,
		value: Array.from(proof.value),
	});
}

export async function action({ request, params, context }: Route.ActionArgs) {
	assertSameOrigin(request);

	const { config } = services(context);
	const control = config.localnetControlUrl;

	if (!control || params.action !== "faucet") {
		return errorResponse(404, "Not found");
	}

	const body = await readJson(request);
	const wallet = addressSchema.safeParse(
		typeof body === "object" && body !== null
			? Reflect.get(body, "address")
			: null,
	);

	if (!wallet.success) return errorResponse(400, "Bad address");

	const response = await fetch(`${control}/faucet`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ address: wallet.data }),
	});

	if (!response.ok) return errorResponse(502, "The local faucet refused");

	return jsonResponse({ ok: true, testOnly: true });
}
