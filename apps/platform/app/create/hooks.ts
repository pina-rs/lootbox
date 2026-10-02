/** Chain reads the wizard needs, with loading and error states. */
import { createSolanaRpc } from "@solana/kit";
import { useCallback, useEffect, useState } from "react";

import { clusterTime } from "../lib/clock.js";
import {
	type ExclusiveCollectionInfo,
	readExclusiveCollection,
} from "../lib/exclusive-chain.js";
import { type Holding, solBalance, walletHoldings } from "../lib/holdings.js";

export type Load<T> =
	| Readonly<{ status: "loading" }>
	| Readonly<{ status: "ready"; value: T }>
	| Readonly<{ status: "error"; message: string }>;

function useLoad<T>(
	load: (() => Promise<T>) | null,
): [Load<T>, () => void] {
	const [state, setState] = useState<Load<T>>({ status: "loading" });
	const [version, setVersion] = useState(0);

	useEffect(() => {
		if (!load) return;

		let live = true;

		setState({ status: "loading" });
		load().then(
			(value) => live && setState({ status: "ready", value }),
			(error: unknown) =>
				live &&
				setState({
					status: "error",
					message: error instanceof Error ? error.message : "Request failed",
				}),
		);

		return () => {
			live = false;
		};
	}, [load, version]);

	return [state, () => setVersion((value) => value + 1)];
}

/** The cluster's clock in Unix seconds (Surfpool can time-travel). */
export function useChainNow(rpcUrl: string | null): Load<number> {
	const load = useCallback(async () => {
		if (!rpcUrl) throw new Error("No RPC");

		return clusterTime(createSolanaRpc(rpcUrl));
	}, [rpcUrl]);

	return useLoad(rpcUrl ? load : null)[0];
}

export function useHoldings(
	rpcUrl: string | null,
	owner: string | null,
): [Load<Holding[]>, () => void] {
	const load = useCallback(
		() => walletHoldings(rpcUrl ?? "", owner ?? ""),
		[rpcUrl, owner],
	);

	return useLoad(rpcUrl && owner ? load : null);
}

export function useSolBalance(
	rpcUrl: string | null,
	owner: string | null,
): [Load<bigint>, () => void] {
	const load = useCallback(
		() => solBalance(rpcUrl ?? "", owner ?? ""),
		[rpcUrl, owner],
	);

	return useLoad(rpcUrl && owner ? load : null);
}

/** The cluster's Exclusive Lootbox NFT collection, or `null` without one. */
export function useExclusiveCollection(
	rpcUrl: string | null,
	collection: string | null,
): Load<ExclusiveCollectionInfo | null> | null {
	const load = useCallback(
		() => readExclusiveCollection(rpcUrl ?? "", collection ?? ""),
		[rpcUrl, collection],
	);
	const [state] = useLoad(rpcUrl && collection ? load : null);

	return rpcUrl && collection ? state : null;
}
