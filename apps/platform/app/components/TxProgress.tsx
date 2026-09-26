/**
 * Transaction progress: one line per SDK step, confirmed steps link to the
 * explorer, and the latest step is announced to screen readers.
 */
import { useCallback, useState } from "react";

import { type ClusterInfo, explorerUrl } from "../lib/clusters.js";

export type TxStep = Readonly<{ label: string; signature: string | null }>;

export function useTxProgress() {
	const [steps, setSteps] = useState<readonly TxStep[]>([]);
	const progress = useCallback((label: string, signature?: string) => {
		setSteps((current) => {
			const last = current.at(-1);

			if (signature) {
				return last && last.label === label && last.signature === null
					? [...current.slice(0, -1), { label, signature }]
					: [...current, { label, signature }];
			}

			return [...current, { label, signature: null }];
		});
	}, []);
	const reset = useCallback(() => setSteps([]), []);

	return { steps, progress, reset };
}

export function TxProgress(
	{ steps, cluster, busy, title = "Progress" }: Readonly<{
		steps: readonly TxStep[];
		cluster: ClusterInfo;
		busy: boolean;
		title?: string;
	}>,
) {
	const latest = steps.at(-1);

	return (
		<div className="stack">
			<h3>{title}</h3>
			<ol className="progress" data-testid="tx-progress">
				{steps.map((step, index) => (
					<li
						key={`${index}-${step.label}`}
						data-state={step.signature
							? "done"
							: busy && index === steps.length - 1
							? "active"
							: "idle"}
					>
						<span>
							{step.label}
							{step.signature && (
								<>
									{" "}
									<a
										href={explorerUrl(cluster, "tx", step.signature)}
										target="_blank"
										rel="noreferrer"
									>
										view
									</a>
								</>
							)}
						</span>
					</li>
				))}
			</ol>
			<p className="visually-hidden" aria-live="polite" role="status">
				{latest
					? latest.signature
						? `${latest.label} confirmed.`
						: `${latest.label}. Approve in your wallet.`
					: ""}
			</p>
		</div>
	);
}
