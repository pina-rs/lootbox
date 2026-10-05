/**
 * Step 2: prize bundles. A bundle is one to four prizes won together; its
 * copy count is how many boxes can win it. Odds update as you type.
 */
import { useState } from "react";

import type { UiWalletAccount } from "@wallet-standard/react";

import { compactUsd } from "../lib/catalog.js";
import type { Holding } from "../lib/holdings.js";
import { describeAsset, describeChance } from "../lib/plan.js";
import { usePublicConfig } from "../lib/public-config.js";
import type { DraftAsset, DraftBundle } from "../lib/schemas.js";
import type { WizardAction } from "./draft.js";
import type { Load } from "./hooks.js";
import { usePrices } from "./prices.js";
import { PrizePicker } from "./PrizePicker.js";

const WSOL = "So11111111111111111111111111111111111111112";

/** Approximate USD value of one prize per box, when a price is known. */
function assetUsd(asset: DraftAsset, solUsd: number | null): number | null {
	if (asset.kind === "sol") {
		return solUsd === null ? null : (Number(asset.lamports) / 1e9) * solUsd;
	}

	if (asset.kind === "token" && asset.usdPrice !== null) {
		return (Number(asset.amount) / 10 ** asset.decimals) * asset.usdPrice;
	}

	return null;
}

type Props = Readonly<{
	account: UiWalletAccount;
	bundles: readonly DraftBundle[];
	cluster: string;
	holdings: Load<Holding[]>;
	onRefreshHoldings: () => void;
	problem: string | null;
	dispatch: (action: WizardAction) => void;
}>;

function newBundle(index: number): DraftBundle {
	return {
		id: crypto.randomUUID().slice(0, 8),
		label: index === 0 ? "Grand prize" : `Prize ${index + 1}`,
		quantity: index === 0 ? 1 : 10,
		assets: [],
	};
}

function hasUnique(bundle: DraftBundle): boolean {
	return bundle.assets.some((asset) => asset.kind === "nft");
}

export function BundlesStep(
	{
		account,
		bundles,
		cluster,
		holdings,
		onRefreshHoldings,
		problem,
		dispatch,
	}: Props,
) {
	const [picking, setPicking] = useState<string | null>(null);
	const { features } = usePublicConfig();
	const prices = usePrices([WSOL]);
	const solUsd = prices.usd[WSOL] ?? null;
	const total = bundles.reduce(
		(sum, bundle) => sum + BigInt(bundle.quantity),
		0n,
	);
	const update = (id: string, patch: Partial<DraftBundle>) =>
		dispatch({
			type: "bundles",
			bundles: bundles.map((bundle) =>
				bundle.id === id ? { ...bundle, ...patch } : bundle
			),
		});
	const addAsset = (bundle: DraftBundle, asset: DraftAsset) => {
		update(bundle.id, {
			assets: [...bundle.assets, asset],
			// Unique assets fund exactly one copy.
			...(asset.kind === "nft" ? { quantity: 1 } : {}),
		});
		setPicking(null);
	};

	return (
		<div className="two-col">
			<div className="stack">
				{bundles.length === 0 && (
					<div className="empty">
						<p>
							Start with one prize bundle. Most lootboxes have a rare grand
							prize and a few common ones.
						</p>
					</div>
				)}
				{bundles.map((bundle, index) => (
					<section
						key={bundle.id}
						className="bundle"
						aria-label={`Bundle ${index + 1}: ${bundle.label}`}
					>
						<div className="bundle-head">
							<div className="field">
								<label htmlFor={`label-${bundle.id}`}>Bundle name</label>
								<input
									id={`label-${bundle.id}`}
									value={bundle.label}
									maxLength={40}
									onChange={(event) =>
										update(bundle.id, { label: event.currentTarget.value })}
								/>
							</div>
							<div className="field">
								<label htmlFor={`copies-${bundle.id}`}>Boxes</label>
								<input
									id={`copies-${bundle.id}`}
									type="number"
									min={1}
									max={100000}
									inputMode="numeric"
									value={bundle.quantity}
									disabled={hasUnique(bundle)}
									aria-describedby={hasUnique(bundle)
										? `unique-${bundle.id}`
										: undefined}
									onChange={(event) =>
										update(bundle.id, {
											quantity: Math.max(
												1,
												Math.min(
													100_000,
													Math.floor(Number(event.currentTarget.value) || 1),
												),
											),
										})}
								/>
							</div>
							<button
								type="button"
								className="icon-button"
								aria-label={`Remove ${bundle.label}`}
								onClick={() =>
									dispatch({
										type: "bundles",
										bundles: bundles.filter((item) => item.id !== bundle.id),
									})}
							>
								✕
							</button>
						</div>
						{hasUnique(bundle) && (
							<p id={`unique-${bundle.id}`} className="field-hint">
								Holds an NFT, so exactly one box can win it.
							</p>
						)}
						<ul className="prize-list" aria-label="Prizes in this bundle">
							{bundle.assets.map((asset, assetIndex) => (
								<li key={`${asset.kind}-${assetIndex}`} className="prize-row">
									<span>
										{describeAsset(asset)}
										{assetUsd(asset, solUsd) !== null && (
											<small>
												≈ {compactUsd(assetUsd(asset, solUsd))} per box
											</small>
										)}
										{asset.kind === "token" && asset.issuer && (
											<small>
												{asset.issuer.name} ·{" "}
												{asset.issuer.feeBasisPoints / 100}% issuer fee
											</small>
										)}
									</span>
									<button
										type="button"
										className="icon-button"
										aria-label={`Remove ${describeAsset(asset)}`}
										onClick={() =>
											update(bundle.id, {
												assets: bundle.assets.filter((_, i) =>
													i !== assetIndex
												),
											})}
									>
										✕
									</button>
								</li>
							))}
						</ul>
						{picking === bundle.id
							? (
								<PrizePicker
									account={account}
									cluster={cluster}
									nftPrizes={features.nftPrizes}
									swaps={features.swaps &&
										(cluster === "mainnet" || cluster === "localnet")}
									onRefreshHoldings={onRefreshHoldings}
									copies={bundle.quantity}
									holdings={holdings}
									onAdd={(asset) => addAsset(bundle, asset)}
									onCancel={() => setPicking(null)}
								/>
							)
							: bundle.assets.length < 4 && (
								<button
									type="button"
									className="button button-small"
									onClick={() => setPicking(bundle.id)}
								>
									+ Add prize
								</button>
							)}
					</section>
				))}
				<button
					type="button"
					className="button"
					disabled={bundles.length >= 64}
					onClick={() =>
						dispatch({
							type: "bundles",
							bundles: [...bundles, newBundle(bundles.length)],
						})}
				>
					+ Add a bundle
				</button>
			</div>

			<aside className="card" aria-labelledby="preview-title">
				<h2 id="preview-title">Odds preview</h2>
				<p className="muted">
					{total === 0n
						? "Add bundles to see the odds."
						: `${
							total.toLocaleString("en-US")
						} boxes. Each is one equal ticket.`}
				</p>
				{total > 0n && (
					<table className="odds" data-testid="odds-preview">
						<thead>
							<tr>
								<th scope="col">Bundle</th>
								<th scope="col" className="num">Boxes</th>
								<th scope="col" className="num">Chance</th>
							</tr>
						</thead>
						<tbody>
							{bundles.map((bundle) => (
								<tr key={bundle.id}>
									<td className="prize-name">{bundle.label}</td>
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
				)}
				{problem && <p className="form-error" role="status">{problem}</p>}
			</aside>
		</div>
	);
}
