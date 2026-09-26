/**
 * Step 3: attach Exclusive Lootbox NFTs as the consolation prize.
 *
 * There is one global Introductory collection; creators choose only whether
 * to attach it and how many consolation boxes to add, while its attach window
 * is open. Behind `FEATURE_EXCLUSIVE_NFTS` until the SDK ships the prize kind.
 */
import {
	ExclusiveGallery,
	LayerOddsTables,
	RarityExplainer,
} from "../components/ExclusiveOdds.js";
import { INTRODUCTORY_COLLECTION } from "../lib/exclusive-nft.js";
import type { Consolation } from "../lib/schemas.js";
import type { WizardAction } from "./draft.js";

type Props = Readonly<{
	consolation: Consolation;
	enabled: boolean;
	unavailableReason: string | null;
	/** Cluster clock, to close the attach window on time. */
	now: number | null;
	dispatch: (action: WizardAction) => void;
}>;

function formatDate(seconds: number): string {
	return new Date(seconds * 1000).toLocaleDateString(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

export function ConsolationStep(
	{ consolation, enabled, unavailableReason, now, dispatch }: Props,
) {
	const collection = INTRODUCTORY_COLLECTION;
	const windowOpen = now === null || now < collection.attachUntil;
	const editable = enabled && unavailableReason === null && windowOpen;
	const patch = (value: Partial<Consolation>) =>
		dispatch({ type: "consolation", patch: value });

	return (
		<div className="two-col">
			<section className="card stack" aria-labelledby="consolation-title">
				<h2 id="consolation-title">Exclusive Lootbox NFTs</h2>
				<p>
					Add boxes that hold a one-of-a-kind collectible from the{" "}
					{collection.name}{" "}
					collection instead of a prize bundle. Every lootbox shares the same
					collection and the same odds, so an NFT from yours is as rare as one
					from anywhere else.
				</p>
				{!editable && (
					<p className="notice" role="note" data-testid="exclusive-unavailable">
						{!windowOpen
							? `The ${collection.name} collection closed to new lootboxes on ${
								formatDate(collection.attachUntil)
							}.`
							: unavailableReason ??
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
					<span>
						Add Exclusive Lootbox NFTs as the consolation prize
						<span className="field-hint">
							{" "}(available until {formatDate(collection.attachUntil)})
						</span>
					</span>
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
						<span className="field-hint">No cap: add as many as you like.</span>
					</div>
				)}
				<h3>How rarity works</h3>
				<RarityExplainer collection={collection} />
				<LayerOddsTables collection={collection} />
			</section>
			<section className="card stack" aria-labelledby="gallery-title">
				<h2 id="gallery-title">What people might get</h2>
				<ExclusiveGallery collection={collection} />
			</section>
		</div>
	);
}
