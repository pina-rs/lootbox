/** Serve uploaded cover art from R2. Keys are random and immutable. */
import { services } from "../lib/.server/context.js";
import type { Route } from "./+types/media";

const KEY = /^c-[0-9a-f-]{36}\.(png|jpg|gif|webp)$/;

export async function loader({ params, context }: Route.LoaderArgs) {
	if (!KEY.test(params.key)) throw new Response("Not found", { status: 404 });

	const object = await services(context).media.get(params.key);

	if (!object) throw new Response("Not found", { status: 404 });

	const headers = new Headers();

	object.writeHttpMetadata(headers);
	headers.set("ETag", object.httpEtag);
	headers.set("Cache-Control", "public, max-age=31536000, immutable");
	headers.set("X-Content-Type-Options", "nosniff");

	return new Response(object.body, { headers });
}
