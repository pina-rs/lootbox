/** Step 5: sign and send, with resumable progress. */
import { useWalletAccountTransactionSigner } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { friendlyError } from "../lib/errors.js";

import { TxProgress, useTxProgress } from "../components/TxProgress.js";
import { chainFor, type ClusterInfo } from "../lib/clusters.js";
import type { DraftData } from "../lib/schemas.js";
import type { WizardAction } from "./draft.js";
import { launchLootbox } from "./launch.js";

type Props = Readonly<{
	account: UiWalletAccount;
	cluster: ClusterInfo;
	origin: string;
	draftId: string;
	data: DraftData;
	pinned: Readonly<{ template: string | null; boxMint: string | null }>;
	blocked: string | null;
	/** Save the draft before its identity is pinned on the server. */
	beforeLaunch: () => Promise<void>;
	dispatch: (action: WizardAction) => void;
}>;

export function LaunchStep(
	{
		account,
		cluster,
		origin,
		draftId,
		data,
		pinned,
		blocked,
		beforeLaunch,
		dispatch,
	}: Props,
) {
	const signer = useWalletAccountTransactionSigner(
		account,
		chainFor(cluster.cluster),
	);
	const navigate = useNavigate();
	const { steps, progress, reset } = useTxProgress();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const resuming = pinned.template !== null;

	return (
		<div className="two-col">
			<section className="card" aria-labelledby="launch-title">
				<h2 id="launch-title">
					{resuming ? "Finish launching" : "Ready to launch"}
				</h2>
				<p>
					Your wallet will ask you to approve each step: create the box token,
					create the treasury, then escrow each prize. If anything stops, come
					back and press Resume. Finished steps are never repeated.
				</p>
				{blocked && <p className="form-error" role="alert">{blocked}</p>}
				<button
					type="button"
					className="button button-primary"
					disabled={busy || blocked !== null}
					onClick={async () => {
						setBusy(true);
						setError(null);
						reset();

						try {
							await beforeLaunch();

							const { slug } = await launchLootbox({
								draftId,
								data,
								cluster,
								origin,
								signer,
								pinned,
								progress,
								onIdentity: (identity) =>
									dispatch({
										type: "signing",
										template: identity.template,
										boxMint: identity.boxMint,
									}),
							});

							navigate(`/l/${slug}`);
						} catch (reason) {
							setError(friendlyError(reason));
						} finally {
							setBusy(false);
						}
					}}
				>
					{busy
						? "Launching…"
						: resuming || error
						? "Resume launch"
						: "Launch lootbox"}
				</button>
				{error && (
					<p className="form-error" role="alert">
						{error} Nothing already confirmed is lost; press Resume to continue.
					</p>
				)}
			</section>
			{steps.length > 0 && (
				<aside className="card">
					<TxProgress steps={steps} cluster={cluster} busy={busy} />
				</aside>
			)}
		</div>
	);
}
