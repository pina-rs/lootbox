/**
 * Step 3: Exclusive Lootbox NFTs, the collectible every non-winning box gets.
 *
 * Behind `FEATURE_EXCLUSIVE_NFTS` until the program and SDK ship the prize
 * kind. With the flag off this step is a read-only preview.
 */
import {
	defaultExclusiveWeights,
	exclusiveTierOdds,
} from "../lib/exclusive-nft.js";
import type { Consolation } from "../lib/schemas.js";
import type { WizardAction } from "./draft.js";

type Props = Readonly<{
	consolation: Consolation;
	enabled: boolean;
	unavailableReason: string | null;
	dispatch: (action: WizardAction) => void;
}>;

export function ConsolationStep(
	{ consolation, enabled, unavailableReason, dispatch }: Props,
) {
	const odds = exclusiveTierOdds(consolation.weights);
	const editable = enabled && unavailableReason === null;
	const patch = (value: Partial<Consolation>) =>
		dispatch({ type: "consolation", patch: value });

	return (
		<div className="stack">
			<div className="card">
				<h2>Exclusive Lootbox NFTs</h2>
				<p>
					Add boxes that hold a one-of-a-kind collectible instead of a prize
					bundle. Each is minted when opened, with a rarity from sixteen tiers.
				</p>
				{!editable && (
					<p className="notice" role="note" data-testid="exclusive-unavailable">
						{unavailableReason ??
							"Exclusive Lootbox NFTs are coming soon. You can skip this step."}
					</p>
				)}
				<label className="check">
					<input
						type="checkbox"
						checked={consolation.enabled && editable}
						disabled={!editable}
						onChange={(event) =>
							patch({ enabled: event.currentTarget.checked })}
					/>
					Include Exclusive Lootbox NFT boxes
				</label>
				{consolation.enabled && editable && (
					<div className="field">
						<label htmlFor="consolation-count">How many boxes</label>
						<input
							id="consolation-count"
							type="number"
							min={1}
							max={100000}
							value={consolation.count}
							onChange={(event) =>
								patch({
									count: Math.max(
										0,
										Math.floor(Number(event.currentTarget.value) || 0),
									),
								})}
						/>
					</div>
				)}
			</div>

			<section className="card" aria-labelledby="tiers-title">
				<div className="section-head">
					<h2 id="tiers-title">Rarity</h2>
					<button
						type="button"
						className="button button-small"
						disabled={!editable}
						onClick={() => patch({ weights: defaultExclusiveWeights() })}
					>
						Reset to default
					</button>
				</div>
				<p className="muted">
					By default each tier is half as likely as the one before it.
				</p>
				<div className="tiers">
					{odds.map((tier) => (
						<div key={tier.tier} className="tier">
							<strong>{tier.name}</strong>
							<label className="visually-hidden" htmlFor={`tier-${tier.tier}`}>
								{tier.name} weight
							</label>
							<input
								id={`tier-${tier.tier}`}
								type="number"
								min={0}
								max={1000000}
								value={tier.weight}
								disabled={!editable}
								onChange={(event) => {
									const weights = [...consolation.weights];

									weights[tier.tier] = Math.max(
										0,
										Math.floor(Number(event.currentTarget.value) || 0),
									);
									patch({ weights });
								}}
							/>
							<span className="muted">
								{tier.percent >= 0.01
									? `${tier.percent.toFixed(2)}%`
									: "<0.01%"}
							</span>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
