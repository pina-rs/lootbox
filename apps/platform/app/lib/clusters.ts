/**
 * Solana clusters a lootbox can live on.
 *
 * Every lootbox stores its cluster, so one deployment can host devnet boxes
 * today and mainnet boxes later. `localnet` is the loopback Surfpool sandbox
 * used for development and end-to-end tests; it is never enabled in a hosted
 * deployment because its oracle is a test emulator.
 */
export const CLUSTERS = ["devnet", "mainnet", "localnet"] as const;

export type Cluster = (typeof CLUSTERS)[number];

/** Oracle accounts of the local Surfpool Switchboard emulator. */
export type LocalOracleAccounts = Readonly<{
	queue: string;
	oracle: string;
	programState: string;
	lutSigner: string;
	lut: string;
	stats: string;
}>;

/** What the browser needs to talk to one cluster. */
export type ClusterInfo = Readonly<{
	cluster: Cluster;
	label: string;
	rpcUrl: string;
	/** Present only for localnet: the emulator's fixed oracle accounts. */
	localOracle: LocalOracleAccounts | null;
	/** The Introductory Exclusive Lootbox NFT collection on this cluster. */
	exclusiveCollection: string | null;
}>;

export const CLUSTER_LABELS: Readonly<Record<Cluster, string>> = {
	devnet: "Devnet",
	mainnet: "Mainnet",
	localnet: "Local sandbox",
};

export function parseCluster(value: unknown): Cluster | null {
	return CLUSTERS.find((cluster) => cluster === value) ?? null;
}

/** Wallet Standard chain identifier for a cluster. */
export function chainFor(cluster: Cluster): `solana:${Cluster}` {
	return `solana:${cluster}`;
}

/** Solana Explorer link for a transaction or account. */
export function explorerUrl(
	info: Pick<ClusterInfo, "cluster" | "rpcUrl">,
	kind: "tx" | "address",
	value: string,
): string {
	const url = new URL(`https://explorer.solana.com/${kind}/${value}`);

	if (info.cluster === "devnet") url.searchParams.set("cluster", "devnet");

	if (info.cluster === "localnet") {
		url.searchParams.set("cluster", "custom");
		url.searchParams.set("customUrl", info.rpcUrl);
	}

	return url.toString();
}
