/**
 * Step 4: everything the launch will do, with exact costs and a balance
 * check, before a single signature.
 */
import { getBundleStateEncoder } from "@pina-rs/lootbox";
import { createSolanaRpc } from "@solana/kit";
import { useEffect, useState } from "react";

import type { ClusterInfo } from "../lib/clusters.js";
import { creationCost } from "../lib/costs.js";
import type { Holding } from "../lib/holdings.js";
import {
	describeAsset,
	describeChance,
	escrowLines,
	formatSol,
	formatUnits,
} from "../lib/plan.js";
import type { DraftData } from "../lib/schemas.js";
import type { Load } from "./hooks.js";

type Props = Readonly<{
	data: DraftData;
	cluster: ClusterInfo;
	uriPreview: string;
	holdings: Load<Holding[]>;
	balance: Load<bigint>;
	onRefreshBalance: () => void;
	owner: string;
}>;

export type Shortfall = Readonly<{ label: string; need: string; have: string }>;

function useRentForZero(rpcUrl: string): bigint | null {
	const [rent, setRent] = useState<bigint | null>(null);

	useEffect(() => {
		let live = true;

		createSolanaRpc(rpcUrl).getMinimumBalanceForRentExemption(0n).send().then(
			(value) => live && setRent(value),
			() => live && setRent(null),
		);

		return () => {
			live = false;
		};
	}, [rpcUrl]);

	return rent;
}

export function shortfalls(
	data: DraftData,
	holdings: readonly Holding[],
	solBalance: bigint,
	solNeeded: bigint,
): Shortfall[] {
	const missing: Shortfall[] = [];

	if (solBalance < solNeeded) {
		missing.push({
			label: "SOL",
			need: formatSol(solNeeded),
			have: formatSol(solBalance),
		});
	}

	const needs = new Map<
		string,
		{ gross: bigint; decimals: number; symbol: string }
	>();

	for (const bundle of data.bundles) {
		for (const asset of bundle.assets) {
			if (asset.kind === "sol") continue;

			const mint = asset.mint;
			const line = escrowLines([{ ...bundle, assets: [asset] }])[0];
			const prior = needs.get(mint);

			needs.set(mint, {
				gross: (prior?.gross ?? 0n) + (line?.gross ?? 0n),
				decimals: asset.kind === "token" ? asset.decimals : 0,
				symbol: asset.kind === "token" ? asset.symbol || "tokens" : asset.name,
			});
		}
	}

	for (const [mint, need] of needs) {
		const have = holdings.find((holding) => holding.mint === mint)?.amount ??
			0n;

		if (have < need.gross) {
			missing.push({
				label: need.symbol,
				need: formatUnits(need.gross, need.decimals),
				have: formatUnits(have, need.decimals),
			});
		}
	}

	return missing;
}

export function ReviewStep(
	{ data, cluster, uriPreview, holdings, balance, onRefreshBalance, owner }:
		Props,
) {
	const rent = useRentForZero(cluster.rpcUrl);
	const [faucet, setFaucet] = useState<string | null>(null);
	const total = data.bundles.reduce(
		(sum, bundle) => sum + BigInt(bundle.quantity),
		0n,
	);
	const cost = rent === null ? null : creationCost({
		name: data.details.name.trim(),
		symbol: data.details.symbol.trim(),
		uri: uriPreview,
		bundles: data.bundles,
		bundleBytes: BigInt(getBundleStateEncoder().fixedSize),
		rentForZeroBytes: rent,
	});
	const escrow = escrowLines(data.bundles).filter((line) =>
		line.symbol !== "SOL"
	);
	const missing =
		cost && balance.status === "ready" && holdings.status === "ready"
			? shortfalls(data, holdings.value, balance.value, cost.totalLamports)
			: [];

	return (
		<div className="two-col">
			<div className="stack">
				<section className="card" aria-labelledby="summary-title">
					<h2 id="summary-title">{data.details.name || "Untitled"}</h2>
					<p className="muted">
						{total.toLocaleString("en-US")} boxes · opens {data.details.revealAt
							? new Date(data.details.revealAt * 1000).toLocaleString()
							: "—"} · {cluster.label}
					</p>
					<table className="odds" data-testid="review-odds">
						<thead>
							<tr>
								<th scope="col">Bundle</th>
								<th scope="col" className="num">Boxes</th>
								<th scope="col" className="num">Chance</th>
							</tr>
						</thead>
						<tbody>
							{data.bundles.map((bundle) => (
								<tr key={bundle.id}>
									<td>
										<span className="prize-name">{bundle.label}</span>
										<span className="prize-detail">
											{bundle.assets.map(describeAsset).join(" + ")}
										</span>
									</td>
									<td className="num">
										{bundle.quantity.toLocaleString("en-US")}
									</td>
									<td className="num">
										<strong>
											{describeChance(BigInt(bundle.quantity), total)}
										</strong>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
				<section className="card" aria-labelledby="fixed-title">
					<h2 id="fixed-title">What you can change later</h2>
					<ul>
						<li>
							<strong>Any time:</strong>{" "}
							title, tagline, description, cover art, colour, links, visibility.
						</li>
						<li>
							<strong>Until you lock:</strong>{" "}
							add more prize bundles. Existing bundles never change.
						</li>
						<li>
							<strong>Never:</strong>{" "}
							the on-chain name, symbol, reveal date, and escrowed prizes.
						</li>
					</ul>
				</section>
			</div>

			<aside className="card" aria-labelledby="cost-title">
				<h2 id="cost-title">Cost to launch</h2>
				{cost
					? (
						<dl className="cost-table" data-testid="cost-table">
							{cost.lines.map((line) => (
								<div key={line.key}>
									<dt>
										{line.label}
										<small>{line.note}</small>
									</dt>
									<dd>{formatSol(line.lamports)}</dd>
								</div>
							))}
							<div className="total">
								<dt>Total SOL</dt>
								<dd data-testid="cost-total">
									{formatSol(cost.totalLamports)}
								</dd>
							</div>
						</dl>
					)
					: <p className="muted">Reading rent from the network…</p>}
				{escrow.length > 0 && (
					<>
						<h3>Tokens and NFTs into escrow</h3>
						<dl className="cost-table">
							{escrow.map((line) => (
								<div key={line.key}>
									<dt>
										{line.label}
										{line.issuerFee > 0n && (
											<small>
												Includes {formatUnits(line.issuerFee, line.decimals)}
												{" "}
												issuer fee
											</small>
										)}
									</dt>
									<dd>{formatUnits(line.gross, line.decimals)}</dd>
								</div>
							))}
						</dl>
					</>
				)}
				<p className="fine">
					Launching takes {cost?.transactions ?? "several"}{" "}
					wallet approvals. Box supply is fixed later, when you lock.
				</p>
				{missing.length > 0 && (
					<div className="notice" role="alert" data-testid="shortfall">
						<p>
							<strong>Not enough in this wallet:</strong>
						</p>
						<ul>
							{missing.map((item) => (
								<li key={item.label}>
									{item.label}: need {item.need}, have {item.have}
								</li>
							))}
						</ul>
						{cluster.cluster === "localnet" && (
							<button
								type="button"
								className="button button-small"
								onClick={async () => {
									setFaucet("Requesting test SOL…");

									const response = await fetch("/api/local/faucet", {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ address: owner }),
									});

									setFaucet(
										response.ok ? "Added 100 test SOL." : "Faucet refused.",
									);
									onRefreshBalance();
								}}
							>
								Get test SOL
							</button>
						)}
						{faucet && <p aria-live="polite">{faucet}</p>}
					</div>
				)}
			</aside>
		</div>
	);
}
