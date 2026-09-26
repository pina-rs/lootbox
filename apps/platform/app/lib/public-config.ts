/**
 * Configuration the root loader sends to every page.
 */
import { useRouteLoaderData } from "react-router";

import type { Cluster, ClusterInfo } from "./clusters.js";

export type PublicConfig = Readonly<{
	origin: string;
	clusters: readonly ClusterInfo[];
	defaultCluster: Cluster;
	features: Readonly<{
		exclusiveNfts: boolean;
		nftPrizes: boolean;
		/** "Buy with SOL" through Jupiter (mainnet, or recorded fixtures). */
		swaps: boolean;
	}>;
	/** Wallet address of the signed-in session, if any. */
	session: string | null;
}>;

export function usePublicConfig(): PublicConfig {
	const data = useRouteLoaderData<{ config: PublicConfig }>("root");

	if (!data) throw new Error("root loader data is missing");

	return data.config;
}

export function useClusterInfo(cluster: Cluster): ClusterInfo | null {
	return usePublicConfig().clusters.find((info) => info.cluster === cluster) ??
		null;
}
