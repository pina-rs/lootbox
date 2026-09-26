/**
 * Step 3: add Exclusive Lootbox NFTs as the consolation prize.
 *
 * There is one shared Introductory collection. A creator only chooses how
 * many boxes should hold one, while the collection's attach window is open;
 * the rarity tables are the protocol's, not the creator's.
 */
import {
	ExclusiveGallery,
	LayerOddsTables,
	RarityExplainer,
} from "../components/ExclusiveOdds.js";
import type { ExclusiveCollectionInfo } from "../lib/exclusive-chain.js";
import { EXCLUSIVE_LABEL } from "../lib/exclusive-nft.js";
import { formatSol } from "../lib/plan.js";
import type { Consolation } from "../lib/schemas.js";
import type { WizardAction } from "./draft.js";
import type { Load } from "./hooks.js";

type Props = Readonly<{
	consolation: Consolation;
	enabled: boolean;
	collection: Load<ExclusiveCollectionInfo | null> | null;
	/** Cluster clock, to close the attach window on time. */
	now: number | null;
	dispatch: (action: WizardAction) => void;
}>;

const MINT_FEE = 90_000n;

function formatDate(seconds: number): string {
	return new Date(seconds * 1000).toLocaleDateString(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

/** Why the collection cannot be attached right now, or `null`. */
export function consolationUnavailable(
	enabled: boolean,
	collection: Load<ExclusiveCollectionInfo | null> | null,
	now: number | null,
): string | null {
	if (!enabled || collection === null) {
		return `${EXCLUSIVE_LABEL}s aren't available on this network yet. You can skip this step.`;
	}

	if (collection.status === "loading") return "Checking the collection…";

	if (collection.status === "error" || collection.value === null) {
		return `The ${EXCLUSIVE_LABEL} collection could not be read. You can skip this step.`;
	}

	const info = collection.value;

	if (!info.published) return "The collection is not open yet.";

	if (now !== null && now < info.attachOpensAt) {
		return `The collection opens to new lootboxes on ${
			formatDate(info.attachOpensAt)
		}.`;
	}

	if (now !== null && now >= info.attachClosesAt) {
		return `The collection closed to new lootboxes on ${
			formatDate(info.attachClosesAt)
		}.`;
	}

	return null;
}

export function ConsolationStep(
	{ consolation, enabled, collection, now, dispatch }: Props,
) {
	const unavailable = consolationUnavailable(enabled, collection, now);
	const info = collection?.status === "ready" ? collection.value : null;
	const patch = (value: Partial<Consolation>) =>
		dispatch({ type: "consolation", patch: value });

	return (
		<div className="two-col">
			<section className="card stack" aria-labelledby="consolation-title">
				<h2 id="consolation-title">{EXCLUSIVE_LABEL}s</h2>
				<p>
					Boxes that don't win a prize bundle can still hold something to show
					off: a one-of-a-kind collectible from the shared Introductory
					collection, minted when it's claimed. Every lootbox uses the same
					odds, so one from yours is as rare as one from anywhere.
				</p>
				{unavailable
					? (
						<p
							className="notice"
							role="note"
							data-testid="exclusive-unavailable"
						>
							{unavailable}
						</p>
					)
					: (
						<>
							<label className="check">
								<input
									type="checkbox"
									checked={consolation.enabled}
									onChange={(event) =>
										patch({
											enabled: event.currentTarget.checked,
											count: consolation.count || 10,
										})}
								/>
								<span>
									Add {EXCLUSIVE_LABEL}s as the consolation prize
									{info && (
										<span className="field-hint">
											{" "}(available until {formatDate(info.attachClosesAt)})
										</span>
									)}
								</span>
							</label>
							{consolation.enabled && (
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
													1,
													Math.floor(Number(event.currentTarget.value) || 1),
												),
											})}
									/>
									<span className="field-hint">
										No cap. Each one escrows Bubblegum's {formatSol(MINT_FEE)}
										{" "}
										mint fee, returned if unused.
									</span>
								</div>
							)}
						</>
					)}
				<h3>How rarity works</h3>
				<RarityExplainer />
				<LayerOddsTables />
			</section>
			<section className="card stack" aria-labelledby="gallery-title">
				<h2 id="gallery-title">What people might get</h2>
				<ExclusiveGallery />
			</section>
		</div>
	);
}
