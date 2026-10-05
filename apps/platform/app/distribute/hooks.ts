/** Chain reads for handing boxes out: balances and airdrop costs. */
import {
	findAssociatedTokenPda,
	TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import { address, createSolanaRpc, fetchEncodedAccounts } from "@solana/kit";
import { useCallback, useEffect, useState } from "react";

import { type Load, useLoad } from "../create/hooks.js";
import { readClient } from "../lib/chain.js";
import { TOKEN_2022_ACCOUNT_BYTES } from "../lib/costs.js";
import {
	type AirdropCost,
	airdropCost,
	type Recipient,
} from "../lib/distribution.js";

/** Most accounts one `getMultipleAccounts` call returns. */
const ACCOUNTS_PER_READ = 100;

/** Boxes in `owner`'s wallet. */
export function useBoxBalance(
	rpcUrl: string,
	owner: string | null,
	boxMint: string,
): [Load<bigint>, () => void] {
	const load = useCallback(
		() => readClient(rpcUrl).boxBalance(address(owner ?? ""), address(boxMint)),
		[rpcUrl, owner, boxMint],
	);

	return useLoad(owner ? load : null);
}

/** `value`, but only after it has held still for `delay` ms. */
function useSettled(value: string, delay: number): string {
	const [settled, setSettled] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setSettled(value), delay);

		return () => clearTimeout(timer);
	}, [value, delay]);

	return settled;
}

/**
 * What sending boxes to `recipients` costs: it checks which recipients
 * already have a box account, because only new accounts cost rent.
 */
export function useAirdropCost(
	rpcUrl: string,
	boxMint: string,
	recipients: readonly Recipient[],
): [Load<AirdropCost> | null, () => void] {
	// Lists are rebuilt on every keystroke; settle on their content instead.
	const key = recipients.map((recipient) => recipient.address).join(",");
	const settled = useSettled(key, 400);
	const load = useCallback(async () => {
		const rpc = createSolanaRpc(rpcUrl);
		const mint = address(boxMint);
		const owners = settled.split(",");
		const accounts = await Promise.all(
			owners.map(async (owner) =>
				(await findAssociatedTokenPda({
					owner: address(owner),
					mint,
					tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
				}))[0]
			),
		);
		let missing = 0;

		for (let start = 0; start < accounts.length; start += ACCOUNTS_PER_READ) {
			const found = await fetchEncodedAccounts(
				rpc,
				accounts.slice(start, start + ACCOUNTS_PER_READ),
			);

			missing += found.filter((account) => !account.exists).length;
		}

		const rent = await rpc.getMinimumBalanceForRentExemption(
			TOKEN_2022_ACCOUNT_BYTES,
		).send();

		return {
			rpcUrl,
			boxMint,
			key: settled,
			cost: airdropCost(owners.length, missing, rent),
		};
	}, [rpcUrl, boxMint, settled]);
	const [state, reload] = useLoad(settled ? load : null);

	if (!key) return [null, reload];

	if (key !== settled) return [{ status: "loading" }, reload];

	if (state.status !== "ready") return [state, reload];

	// A ready result belongs to the request that produced it, including the
	// render before useLoad's effect notices that the request changed.
	if (
		state.value.key !== key || state.value.rpcUrl !== rpcUrl ||
		state.value.boxMint !== boxMint
	) {
		return [{ status: "loading" }, reload];
	}

	return [{ status: "ready", value: state.value.cost }, reload];
}
