/**
 * The prize card body for an Exclusive Lootbox NFT.
 *
 * Its traits are fixed the moment the opening's randomness is verified, so
 * they are derived and shown before the claim. The claim mints the NFT; the
 * card then plays the full Rive reveal of the minted edition from our
 * `/x/<collection>/` host.
 */
import { rarityOf, resolveTraits } from "@pina-rs/exclusive-nft-art";
import {
	fetchExclusiveAttachmentState,
	fetchTemplateOpeningState,
} from "@pina-rs/lootbox";
import { address, createSolanaRpc } from "@solana/kit";
import { useEffect, useState } from "react";

import {
	type MintedExclusive,
	mintedExclusive,
	openingTraits,
	readExclusiveCollection,
} from "../lib/exclusive-chain.js";
import { EXCLUSIVE_LABEL } from "../lib/exclusive-nft.js";

type View = Readonly<{
	collection: string;
	traits: readonly number[];
	minted: MintedExclusive | null;
}>;

function stemOf(minted: MintedExclusive): string {
	return `${
		minted.traits.map((trait) => trait.toString(16).padStart(2, "0")).join("")
	}-${minted.serial}`;
}

export function ExclusivePrize(
	{ rpcUrl, opening, attachment, claimed }: Readonly<{
		rpcUrl: string;
		opening: string;
		attachment: string;
		claimed: boolean;
	}>,
) {
	const [view, setView] = useState<View | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let live = true;
		const rpc = createSolanaRpc(rpcUrl);

		(async () => {
			const [state, binding] = await Promise.all([
				fetchTemplateOpeningState(rpc, address(opening), {
					commitment: "confirmed",
				}),
				fetchExclusiveAttachmentState(rpc, address(attachment), {
					commitment: "confirmed",
				}),
			]);
			const collection = await readExclusiveCollection(
				rpcUrl,
				binding.data.collection,
			);

			if (!collection) throw new Error("The collection is missing");

			const traits = await openingTraits(state, collection);
			const minted = claimed
				? await mintedExclusive(rpcUrl, address(opening))
				: null;

			if (live) setView({ collection: collection.address, traits, minted });
		})().catch((reason: unknown) => {
			if (live) {
				setError(
					reason instanceof Error ? reason.message : "Could not read the NFT",
				);
			}
		});

		return () => {
			live = false;
		};
	}, [rpcUrl, opening, attachment, claimed]);

	if (error) return <p className="form-error">{error}</p>;

	if (!view) {
		return (
			<p className="muted" role="status">Reading your {EXCLUSIVE_LABEL}…</p>
		);
	}

	const rarity = rarityOf(view.traits);
	const traits = resolveTraits(view.traits);

	return (
		<div className="stack exclusive-prize">
			<p className="rarity" data-testid="exclusive-rarity">
				<strong>{rarity.label}</strong>
			</p>
			{view.minted
				? (
					<div className="stack">
						<iframe
							className="nft-player"
							title={`${EXCLUSIVE_LABEL} #${view.minted.serial} reveal`}
							src={`/x/${view.collection}/play.html?nft=${stemOf(view.minted)}`}
							data-testid="exclusive-player"
						/>
						<p className="fine">
							Edition #{view.minted.serial} ·{" "}
							<a href={`/x/${view.collection}/${stemOf(view.minted)}.json`}>
								metadata
							</a>
						</p>
					</div>
				)
				: (
					<p>
						Claim to mint it to your wallet. Its traits are already fixed on
						chain:
					</p>
				)}
			<ul className="trait-list" data-testid="exclusive-traits">
				{traits.map((trait, layer) => <li key={layer}>{trait.name}</li>)}
			</ul>
		</div>
	);
}
