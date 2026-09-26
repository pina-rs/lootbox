/**
 * Typed view of the Worker environment.
 *
 * `wrangler.jsonc` vars arrive as strings and secrets may be absent, so every
 * value is parsed once here. Nothing else reads `env` directly.
 */
import {
	type Cluster,
	CLUSTER_LABELS,
	type ClusterInfo,
	type LocalOracleAccounts,
	parseCluster,
} from "../clusters.js";

/** Secrets set with `wrangler secret put` (or `.dev.vars` locally). */
export type Secrets = Readonly<{
	JUPITER_API_KEY?: string;
	/** DAS-capable RPC for mainnet wallet NFT discovery. */
	DAS_RPC_URL?: string;
	DAS_RPC_URL_DEVNET?: string;
	RELAYER_SECRET_KEY?: string;
}>;

export type WorkerEnv = Env & Secrets;

export type ServerConfig = Readonly<{
	publicOrigin: string | null;
	defaultCluster: Cluster;
	enabledClusters: readonly Cluster[];
	rpcUrls: Readonly<Partial<Record<Cluster, string>>>;
	localnetControlUrl: string | null;
	relayerClusters: readonly Cluster[];
	relayerClaim: boolean;
	features: Readonly<{ exclusiveNfts: boolean }>;
}>;

function clusterList(value: string | undefined): Cluster[] {
	return (value ?? "")
		.split(",")
		.map((item) => parseCluster(item.trim()))
		.filter((item): item is Cluster => item !== null);
}

function isLoopback(url: string): boolean {
	if (!URL.canParse(url)) return false;

	const { hostname, protocol } = new URL(url);

	return protocol === "http:" &&
		["127.0.0.1", "localhost", "[::1]"].includes(hostname);
}

export function readServerConfig(env: WorkerEnv): ServerConfig {
	const controlUrl = env.LOCALNET_CONTROL_URL?.trim() || null;
	// Security: localnet trusts an emulator oracle and a test faucet, so it is
	// only ever enabled against a loopback control plane.
	const localnetAllowed = controlUrl !== null && isLoopback(controlUrl);
	const enabled = clusterList(env.ENABLED_CLUSTERS).filter((cluster) =>
		cluster !== "localnet" || localnetAllowed
	);
	const fallback = parseCluster(env.DEFAULT_CLUSTER) ?? "devnet";

	return {
		publicOrigin: env.PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || null,
		defaultCluster: enabled.includes(fallback)
			? fallback
			: enabled[0] ?? "devnet",
		enabledClusters: enabled.length > 0 ? enabled : ["devnet"],
		rpcUrls: {
			devnet: env.RPC_URL_DEVNET?.trim() || "https://api.devnet.solana.com",
			...(env.RPC_URL_MAINNET?.trim()
				? { mainnet: env.RPC_URL_MAINNET.trim() }
				: {}),
		},
		localnetControlUrl: localnetAllowed ? controlUrl : null,
		relayerClusters: clusterList(env.RELAYER_CLUSTERS).filter((cluster) =>
			cluster !== "localnet" || localnetAllowed
		),
		relayerClaim: env.RELAYER_CLAIM === "true",
		features: { exclusiveNfts: env.FEATURE_EXCLUSIVE_NFTS === "true" },
	};
}

/** The site's canonical origin: configured, or the request's own. */
export function originFor(config: ServerConfig, request: Request): string {
	return config.publicOrigin ?? new URL(request.url).origin;
}

type LocalControlConfig = Readonly<{
	rpcUrl: string;
	oracle: LocalOracleAccounts;
}>;

let localControl: Promise<LocalControlConfig> | null = null;

function isLocalControlConfig(value: unknown): value is LocalControlConfig {
	if (typeof value !== "object" || value === null) return false;

	const rpcUrl = Reflect.get(value, "rpcUrl");
	const testOnly = Reflect.get(value, "testOnly");
	const oracle = Reflect.get(value, "oracle");

	return typeof rpcUrl === "string" && isLoopback(rpcUrl) &&
		testOnly === true && typeof oracle === "object" && oracle !== null &&
		["queue", "oracle", "programState", "lutSigner", "lut", "stats"].every(
			(key) => typeof Reflect.get(oracle, key) === "string",
		);
}

/** The Surfpool control plane's `/config`, cached per isolate. */
export function localControlConfig(
	config: ServerConfig,
): Promise<LocalControlConfig> {
	const url = config.localnetControlUrl;

	if (!url) return Promise.reject(new Error("localnet is not enabled"));

	localControl ??= fetch(`${url}/config`).then(async (response) => {
		const body: unknown = await response.json();

		if (!response.ok || !isLocalControlConfig(body)) {
			throw new Error("the local Surfpool control plane is not running");
		}

		return body;
	}).catch((error: unknown) => {
		// Do not cache a failure: the control plane may start later.
		localControl = null;
		throw error;
	});

	return localControl;
}

/** RPC URL for a cluster, as the server should use it. */
export async function rpcUrlFor(
	config: ServerConfig,
	cluster: Cluster,
): Promise<string> {
	if (cluster === "localnet") return (await localControlConfig(config)).rpcUrl;

	const url = config.rpcUrls[cluster];

	if (!url) throw new Error(`${cluster} RPC is not configured`);

	return url;
}

/** Everything the browser needs per enabled cluster. */
export async function clusterInfos(
	config: ServerConfig,
): Promise<ClusterInfo[]> {
	const infos: ClusterInfo[] = [];

	for (const cluster of config.enabledClusters) {
		if (cluster === "localnet") {
			const local = await localControlConfig(config).catch(() => null);

			if (!local) continue;

			infos.push({
				cluster,
				label: CLUSTER_LABELS[cluster],
				rpcUrl: local.rpcUrl,
				localOracle: local.oracle,
			});
			continue;
		}

		const rpcUrl = config.rpcUrls[cluster];

		if (!rpcUrl) continue;

		infos.push({
			cluster,
			label: CLUSTER_LABELS[cluster],
			rpcUrl,
			localOracle: null,
		});
	}

	return infos;
}
