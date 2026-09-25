import { type Address, address, isAddress } from "@solana/kit";

/** Product name shown across the launch site. One constant so it can change. */
export const BRAND = "Unlisted";

export type Cluster = "localnet" | "devnet" | "mainnet";

/**
 * Network settings resolved once at startup from the static Vite build.
 *
 * `treasury` is the locked template the recipient flow reads. On localnet the
 * `?treasury=` query parameter may override it so a series created in the
 * `/playground` workshop can be opened from the recipient site; public
 * clusters only trust the build-time value.
 */
export type LaunchConfig = Readonly<{
	cluster: Cluster;
	rpcUrl: string;
	treasury: Address | null;
}>;

export type LaunchEnv = Readonly<{
	VITE_SOLANA_CLUSTER?: string;
	VITE_RPC_URL?: string;
	VITE_TREASURY?: string;
}>;

const DEFAULT_RPC: Readonly<Record<Cluster, string>> = {
	localnet: "",
	devnet: "https://api.devnet.solana.com",
	mainnet: "https://api.mainnet-beta.solana.com",
};

function parseCluster(value: string | undefined): Cluster {
	if (!value) return "localnet";

	if (value === "localnet" || value === "devnet" || value === "mainnet") {
		return value;
	}

	throw new Error(
		`VITE_SOLANA_CLUSTER must be localnet, devnet, or mainnet (got "${value}")`,
	);
}

function parseTreasury(value: string | null | undefined): Address | null {
	const trimmed = value?.trim();

	if (!trimmed) return null;

	if (!isAddress(trimmed)) {
		throw new Error(`Treasury "${trimmed}" is not a valid Solana address`);
	}

	return address(trimmed);
}

export function readLaunchConfig(env: LaunchEnv, search = ""): LaunchConfig {
	const cluster = parseCluster(env.VITE_SOLANA_CLUSTER);
	const override = cluster === "localnet"
		? new URLSearchParams(search).get("treasury")
		: null;

	return Object.freeze({
		cluster,
		rpcUrl: env.VITE_RPC_URL?.trim() || DEFAULT_RPC[cluster],
		treasury: parseTreasury(override) ?? parseTreasury(env.VITE_TREASURY),
	});
}

/** Solana Explorer link for a transaction or account on the configured cluster. */
export function explorerUrl(
	config: Pick<LaunchConfig, "cluster" | "rpcUrl">,
	kind: "tx" | "address",
	value: string,
): string {
	const url = new URL(`https://explorer.solana.com/${kind}/${value}`);

	if (config.cluster === "devnet") url.searchParams.set("cluster", "devnet");

	if (config.cluster === "localnet") {
		url.searchParams.set("cluster", "custom");
		url.searchParams.set("customUrl", config.rpcUrl || "http://127.0.0.1:8899");
	}

	return url.toString();
}
