/**
 * "Hand out your boxes": where every box is right now (your wallet, the
 * curve, out in the world), and the two ways to move them.
 */
import type { LootboxClient } from "@pina-rs/lootbox";
import { OddsStrip } from "@pina-rs/lootbox-ui";

import type { LootboxChainView } from "../lib/chain.js";
import { curveLeft } from "../lib/curve.js";
import { usePublicConfig } from "../lib/public-config.js";
import { AirdropCard, type Run } from "./AirdropCard.js";
import { CurveCard } from "./CurveCard.js";
import { useBoxBalance } from "./hooks.js";

type Props = Readonly<{
	client: LootboxClient;
	rpcUrl: string;
	chain: LootboxChainView;
	owner: string;
	now: number;
	busy: boolean;
	run: Run;
}>;

export function HandOut(
	{ client, rpcUrl, chain, owner, now, busy, run }: Props,
) {
	const { features } = usePublicConfig();
	const [balanceLoad, reloadBalance] = useBoxBalance(
		rpcUrl,
		owner,
		chain.boxMint,
	);
	const balance = balanceLoad.status === "ready" ? balanceLoad.value : null;
	const supply = BigInt(chain.supply);
	const onCurve = chain.curve ? curveLeft(chain.curve) : 0n;
	const out = balance === null ? null : supply - balance - onCurve;

	// Every transaction here moves boxes, so re-read the wallet afterwards.
	const runAndRefresh: Run = async (work) => {
		await run(work);
		reloadBalance();
	};

	return (
		<section className="stack hand-out" aria-labelledby="hand-out-title">
			<div className="section-head">
				<h2 id="hand-out-title">Hand out your boxes</h2>
				<span className="muted">
					{supply.toLocaleString("en-US")} boxes in all
				</span>
			</div>
			{balance !== null && out !== null && (
				<OddsStrip
					className="box-split"
					phrasing="share"
					segments={[
						{
							key: "wallet",
							label: "In your wallet",
							count: Number(balance),
							tone: "gold",
						},
						...(features.boxCurves
							? [{
								key: "curve",
								label: "On the curve",
								count: Number(onCurve),
								tone: "teal" as const,
							}]
							: []),
						{
							key: "out",
							label: "With holders",
							count: Number(out),
							tone: "sky",
						},
					]}
				/>
			)}
			<div className="hand-out-paths">
				<AirdropCard
					client={client}
					rpcUrl={rpcUrl}
					boxMint={chain.boxMint}
					owner={owner}
					balance={balance}
					busy={busy}
					run={runAndRefresh}
				/>
				{features.boxCurves && (
					<CurveCard
						client={client}
						chain={chain}
						balance={balance}
						now={now}
						busy={busy}
						run={runAndRefresh}
					/>
				)}
			</div>
		</section>
	);
}
