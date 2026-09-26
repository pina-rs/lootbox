/**
 * Worker entry: React Router for requests, the settlement relayer for cron.
 */
import { createRequestHandler, type ServerBuild } from "react-router";

import { readServerConfig, type WorkerEnv } from "../app/lib/.server/env.js";
import { runRelayer } from "../app/lib/.server/relayer.js";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: WorkerEnv;
			ctx: ExecutionContext;
		};
	}
}

// The virtual module's generated type marks `basename` optional, which
// `exactOptionalPropertyTypes` rejects; it is the same ServerBuild at runtime.
const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build") as Promise<ServerBuild>,
	import.meta.env.MODE,
);

export default {
	fetch(request, env, ctx) {
		return requestHandler(request, { cloudflare: { env, ctx } });
	},
	async scheduled(_controller, env) {
		const run = await runRelayer(
			env,
			readServerConfig(env),
			() => Math.floor(Date.now() / 1000),
		);

		if (run.ran) console.log(JSON.stringify({ event: "relayer", ...run }));
	},
} satisfies ExportedHandler<WorkerEnv>;
