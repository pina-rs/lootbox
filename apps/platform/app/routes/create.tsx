/**
 * `/create`: the five-step wizard. Drafts save to D1 as you type and resume
 * from chain state after a reload.
 */
import type { UiWalletAccount } from "@wallet-standard/react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import * as sdk from "@pina-rs/lootbox";
import { BundlesStep } from "../create/BundlesStep.js";
import { ConsolationStep } from "../create/ConsolationStep.js";
import { DetailsStep } from "../create/DetailsStep.js";
import {
	emptyDraft,
	STEPS,
	useAutosave,
	useWizard,
	type WizardState,
} from "../create/draft.js";
import { useChainNow, useHoldings, useSolBalance } from "../create/hooks.js";
import { metadataUri } from "../create/launch.js";
import { LaunchStep } from "../create/LaunchStep.js";
import { ReviewStep } from "../create/ReviewStep.js";
import { currentWallet } from "../lib/.server/auth.js";
import { nowSeconds, services } from "../lib/.server/context.js";
import { draftById, type DraftRecord, latestDraft } from "../lib/.server/db.js";
import type { Cluster } from "../lib/clusters.js";
import { exclusiveNftAdapter } from "../lib/exclusive-nft.js";
import { checkPlan, draftBundlesToInputs } from "../lib/plan.js";
import { usePublicConfig } from "../lib/public-config.js";
import { launchDetailsSchema } from "../lib/schemas.js";
import { RequireSignIn, useSession } from "../wallet/session.js";
import type { Route } from "./+types/create";

export function meta() {
	return [
		{ title: "Make a lootbox — lootbox.so" },
		{
			name: "description",
			content: "Fill a Solana lootbox with prizes and share it.",
		},
	];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const app = services(context);
	const wallet = await currentWallet(app.db, request, nowSeconds());

	if (!wallet) return { draft: null as DraftRecord | null };

	const id = new URL(request.url).searchParams.get("draft");
	const draft = id
		? await draftById(app.db, id, wallet)
		: await latestDraft(app.db, wallet);

	return { draft };
}

function initialState(
	draft: DraftRecord | null,
	cluster: Cluster,
): WizardState {
	if (!draft) {
		return {
			id: crypto.randomUUID(),
			cluster,
			step: 1,
			data: emptyDraft(),
			signing: false,
			template: null,
			boxMint: null,
		};
	}

	return {
		id: draft.id,
		cluster: draft.cluster,
		step: draft.status === "signing" ? 5 : Math.min(Math.max(draft.step, 1), 4),
		data: draft.data,
		signing: draft.status === "signing",
		template: draft.template,
		boxMint: draft.boxMint,
	};
}

const exclusive = exclusiveNftAdapter(sdk);

function Wizard(
	{ account, draft }: Readonly<
		{ account: UiWalletAccount; draft: DraftRecord | null }
	>,
) {
	const config = usePublicConfig();
	const [state, dispatch] = useWizard(
		useMemo(() => initialState(draft, config.defaultCluster), [
			draft,
			config.defaultCluster,
		]),
	);
	const { status: saveStatus, flush } = useAutosave(state, dispatch, true);
	const cluster =
		config.clusters.find((info) => info.cluster === state.cluster) ??
			config.clusters[0] ?? null;
	const rpcUrl = cluster?.rpcUrl ?? null;
	const chainNow = useChainNow(rpcUrl);
	const [holdings, refreshHoldings] = useHoldings(rpcUrl, account.address);
	const [balance, refreshBalance] = useSolBalance(rpcUrl, account.address);
	const { details, bundles } = state.data;
	const [reviewProblem, setReviewProblem] = useState<string | null>(null);
	const detailsCheck = launchDetailsSchema.safeParse(details);
	const now = chainNow.status === "ready" ? chainNow.value : null;
	const revealProblem =
		details.revealAt && now !== null && details.revealAt - now < 600
			? "Pick a reveal time at least 10 minutes away."
			: null;
	const detailsProblem = detailsCheck.success
		? revealProblem
		: detailsCheck.error.issues[0]?.message ?? "Check the details";
	const planCheck = bundles.length === 0
		? { ok: false as const, message: "Add at least one bundle." }
		: bundles.some((bundle) => bundle.label.trim() === "")
		? { ok: false as const, message: "Every bundle needs a name." }
		: bundles.some((bundle) => bundle.assets.length === 0)
		? { ok: false as const, message: "Every bundle needs at least one prize." }
		: checkPlan({
			name: details.name.trim() || "Lootbox",
			uri: "",
			opensAt: BigInt(details.revealAt ?? 0),
			bundles: draftBundlesToInputs(bundles, (mint) => mint),
		});
	const prizesProblem = planCheck.ok ? null : planCheck.message;
	const problemFor = (step: number): string | null =>
		step === 1
			? detailsProblem
			: step === 2
			? prizesProblem
			: step === 4
			? reviewProblem
			: null;
	const canEnter = (step: number) =>
		Array.from({ length: step - 1 }, (_, index) => problemFor(index + 1)).every(
			(problem) => problem === null,
		);
	const goTo = (step: number) => {
		if (canEnter(step)) dispatch({ type: "step", step });
	};

	if (!cluster) {
		return (
			<p className="notice">No Solana network is configured for this site.</p>
		);
	}

	const step = state.step;
	const problem = problemFor(step);

	return (
		<div className="stack">
			<ol className="wizard-steps" aria-label="Steps">
				{STEPS.map((label, index) => (
					<li
						key={label}
						data-state={index + 1 < step
							? "done"
							: index + 1 === step
							? "current"
							: "todo"}
						aria-current={index + 1 === step ? "step" : undefined}
					>
						<span>{label}</span>
					</li>
				))}
			</ol>
			<div className="section-head">
				<h1 className="display" style={{ fontSize: "clamp(26px, 5vw, 40px)" }}>
					{STEPS[step - 1]}
				</h1>
				<span className="fine" aria-live="polite">
					{state.signing
						? "Launching"
						: saveStatus === "saving"
						? "Saving…"
						: saveStatus === "saved"
						? "Draft saved"
						: saveStatus === "error"
						? "Not saved; check your connection"
						: ""}
				</span>
			</div>

			{step === 1 && (
				<DetailsStep
					details={details}
					cluster={state.cluster}
					clusters={config.clusters}
					locked={state.signing}
					chainNow={chainNow}
					dispatch={dispatch}
				/>
			)}
			{step === 2 && (
				<BundlesStep
					account={account}
					bundles={bundles}
					cluster={cluster.cluster}
					holdings={holdings}
					onRefreshHoldings={refreshHoldings}
					problem={prizesProblem}
					dispatch={dispatch}
				/>
			)}
			{step === 3 && (
				<ConsolationStep
					consolation={state.data.consolation}
					enabled={config.features.exclusiveNfts}
					unavailableReason={exclusive.status === "unavailable"
						? exclusive.reason
						: null}
					now={now}
					dispatch={dispatch}
				/>
			)}
			{step === 4 && (
				<ReviewStep
					data={state.data}
					cluster={cluster}
					uriPreview={metadataUri(config.origin, account.address)}
					holdings={holdings}
					balance={balance}
					owner={account.address}
					onBlocked={setReviewProblem}
					onRefreshBalance={() => {
						refreshBalance();
						refreshHoldings();
					}}
				/>
			)}
			{step === 5 && state.id && (
				<LaunchStep
					account={account}
					cluster={cluster}
					origin={config.origin}
					draftId={state.id}
					data={state.data}
					pinned={{ template: state.template, boxMint: state.boxMint }}
					blocked={detailsProblem ?? prizesProblem}
					beforeLaunch={state.signing ? () => Promise.resolve() : flush}
					dispatch={dispatch}
				/>
			)}

			{step < 5 && (
				<nav className="wizard-nav" aria-label="Wizard">
					{step > 1
						? (
							<button
								type="button"
								className="button"
								onClick={() => dispatch({ type: "step", step: step - 1 })}
							>
								Back
							</button>
						)
						: <Link to="/">Cancel</Link>}
					<span className="stack" style={{ justifyItems: "end", gap: 6 }}>
						{problem && (
							<span className="form-error" role="status">{problem}</span>
						)}
						<button
							type="button"
							className="button button-primary"
							disabled={problem !== null}
							onClick={() => goTo(step + 1)}
						>
							{step === 3
								? "Review"
								: step === 4
								? "Continue to launch"
								: "Next"}
						</button>
					</span>
				</nav>
			)}
			{step === 5 && !state.signing && (
				<nav className="wizard-nav" aria-label="Wizard">
					<button
						type="button"
						className="button"
						onClick={() =>
							dispatch({ type: "step", step: 4 })}
					>
						Back to review
					</button>
				</nav>
			)}
		</div>
	);
}

export default function Create({ loaderData }: Route.ComponentProps) {
	const { account } = useSession();

	return (
		<main id="main" className="page">
			<RequireSignIn why="Drafts are saved to your wallet so you can pick up where you left off.">
				{account && (
					<Wizard
						key={loaderData.draft?.id ?? "new"}
						account={account}
						draft={loaderData.draft}
					/>
				)}
			</RequireSignIn>
		</main>
	);
}
