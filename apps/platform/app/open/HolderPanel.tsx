/**
 * Everything a connected holder does on a lootbox page: see their boxes,
 * hold the chest to open one, claim prizes, finish interrupted openings, and
 * send boxes to friends.
 */
import {
	type ChainOpening,
	fetchTemplateOpeningState,
	LootboxClient,
	relayTemplateOpenings,
} from "@pina-rs/lootbox";
import { type Address, address, isAddress } from "@solana/kit";
import { useWalletAccountTransactionSigner } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import {
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useState,
	useSyncExternalStore,
} from "react";
import { useRevalidator } from "react-router";
import { friendlyError } from "../lib/errors.js";

import { TxProgress, useTxProgress } from "../components/TxProgress.js";
import { openingsFor } from "../lib/chain.js";
import { chainFor, type ClusterInfo, explorerUrl } from "../lib/clusters.js";
import {
	ELIGIBILITY_STATEMENT,
	type PrizeView,
	stockDisclaimer,
} from "../lib/prizes.js";
import { formatDuration } from "../lib/status.js";
import { Chest } from "./Chest.js";
import { ExclusivePrize } from "./ExclusivePrize.js";
import {
	initialOpening,
	openingAnnouncement,
	openingReducer,
	type RecordedResult,
} from "./openingMachine.js";
import { oracleTransport } from "./oracle.js";

type Props = Readonly<{
	account: UiWalletAccount;
	cluster: ClusterInfo;
	template: string;
	boxMint: string;
	prizes: readonly PrizeView[];
	reveal: "unlocked" | "sealed" | "open" | "retired";
	secondsToReveal: number;
}>;

const SETTLE_ATTEMPTS = 40;
const SETTLE_DELAY_MS = 750;

function message(error: unknown): string {
	return friendlyError(error);
}

function prefersReducedMotion(): boolean {
	return typeof matchMedia !== "undefined" &&
		matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeMotion(callback: () => void): () => void {
	const query = matchMedia("(prefers-reduced-motion: reduce)");

	query.addEventListener("change", callback);

	return () => query.removeEventListener("change", callback);
}

function useReducedMotion(): boolean {
	return useSyncExternalStore(
		subscribeMotion,
		prefersReducedMotion,
		() => false,
	);
}

export function HolderPanel(
	{ account, cluster, template, boxMint, prizes, reveal, secondsToReveal }:
		Props,
) {
	const signer = useWalletAccountTransactionSigner(
		account,
		chainFor(cluster.cluster),
	);
	const { steps, progress, reset } = useTxProgress();
	const client = useMemo(
		() => new LootboxClient(cluster.rpcUrl, signer, progress),
		[cluster.rpcUrl, signer, progress],
	);
	const oracle = useMemo(() => oracleTransport(cluster), [cluster]);
	const revalidator = useRevalidator();
	const reducedMotion = useReducedMotion();
	const [state, dispatch] = useReducer(openingReducer, initialOpening);
	const [boxes, setBoxes] = useState<bigint | null>(null);
	const [openings, setOpenings] = useState<readonly ChainOpening[]>([]);
	const [hint, setHint] = useState<string | null>(null);
	const [eligible, setEligible] = useState(false);
	const [version, setVersion] = useState(0);
	const owner = address(account.address);
	const refresh = useCallback(() => {
		setVersion((value) => value + 1);
		void revalidator.revalidate();
	}, [revalidator]);

	useEffect(() => {
		let live = true;

		Promise.all([
			client.boxBalance(owner, address(boxMint)),
			openingsFor(cluster.rpcUrl, address(template), owner),
		]).then(([balance, mine]) => {
			if (!live) return;

			setBoxes(balance);
			setOpenings(mine.filter((opening) => opening.data.status < 3));
		}).catch((error: unknown) => live && setHint(message(error)));

		return () => {
			live = false;
		};
	}, [client, owner, boxMint, template, cluster.rpcUrl, version]);

	const prizeFor = (index: number) =>
		prizes.find((prize) => prize.index === index);
	const resultFor = (
		opening: Address,
		selected: number,
		signature: string | null,
	): RecordedResult => ({
		opening,
		bundleIndex: selected,
		tier: prizeFor(selected)?.tier ?? "standard",
		signature,
	});
	const titleOf = (result: RecordedResult) =>
		prizeFor(result.bundleIndex)?.title ?? "a prize";

	/** Settle FIFO up to `opening`, waiting for the seed slot and the oracle. */
	const settle = async (opening: Address) => {
		for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
			await relayTemplateOpenings({
				client,
				oracle,
				template: address(template),
				until: opening,
			});

			const current = await fetchTemplateOpeningState(client.rpc, opening, {
				commitment: "processed",
			});

			if (current.data.status >= 2) return current;

			await new Promise((done) => setTimeout(done, SETTLE_DELAY_MS));
		}

		throw new Error(
			"The oracle has not revealed yet. Your burned box is safe; press Finish opening to retry.",
		);
	};

	const open = async () => {
		reset();

		try {
			const current = await client.template(address(template));
			const opening = await client.requestOpen(current, oracle.selectAccounts);

			dispatch({
				type: "committed",
				opening: opening.address,
				signature: null,
			});

			const settled = await settle(opening.address);

			dispatch({
				type: "recorded",
				result: resultFor(opening.address, settled.data.selectedBundle, null),
			});
			refresh();
		} catch (error) {
			dispatch({ type: "fail", message: message(error) });
			refresh();
		}
	};

	const finish = async (opening: ChainOpening) => {
		reset();
		dispatch({ type: "committed", opening: opening.address, signature: null });

		try {
			const settled = await settle(opening.address);

			dispatch({
				type: "recorded",
				result: resultFor(opening.address, settled.data.selectedBundle, null),
			});
		} catch (error) {
			dispatch({ type: "fail", message: message(error) });
		}

		refresh();
	};

	const claim = async (opening: Address) => {
		dispatch({ type: "claim" });

		try {
			await client.claim(opening);
			dispatch({ type: "claimed", signature: null });
		} catch (error) {
			dispatch({ type: "fail", message: message(error) });
		}

		refresh();
	};

	const result = "result" in state && state.result ? state.result : null;
	const resultPrize = result ? prizeFor(result.bundleIndex) : undefined;
	const armed = reveal === "open" && (boxes ?? 0n) > 0n;
	const blockedReason = reveal === "sealed"
		? `Sealed for ${
			formatDuration(secondsToReveal)
		} more. You can send boxes until then.`
		: reveal === "unlocked"
		? "The creator is still filling this lootbox."
		: (boxes ?? 0n) === 0n
		? "You have no boxes from this lootbox."
		: null;
	const busy = state.phase === "burning" || state.phase === "rolling" ||
		state.phase === "claiming";
	const pending = openings.filter((opening) =>
		opening.address !== (result?.opening ?? null)
	);
	const needsEligibility = resultPrize?.issuerStock ?? false;

	return (
		<div className="stack">
			<section className="stage" aria-labelledby="stage-title">
				<h2 id="stage-title" className="visually-hidden">Open a box</h2>
				<p className="chip" data-testid="box-balance">
					{boxes === null
						? "Counting your boxes…"
						: `You have ${boxes.toLocaleString("en-US")} ${
							boxes === 1n ? "box" : "boxes"
						}`}
				</p>
				<Chest
					state={state}
					armed={armed}
					reducedMotion={reducedMotion}
					onHold={(at) => dispatch({ type: "hold", at })}
					onRelease={() => dispatch({ type: "release" })}
					onCharged={() => {
						dispatch({ type: "charged" });
						void open();
					}}
					onBlocked={() => setHint(blockedReason)}
					onRevealFinished={() => dispatch({ type: "revealFinished" })}
				/>
				<p
					className="chest-hint"
					id="chest-hint"
					data-phase={state.phase}
					aria-live="polite"
					aria-atomic="true"
				>
					{state.phase === "idle"
						? hint ??
							(armed
								? "Press and hold the chest to open a box."
								: blockedReason)
						: openingAnnouncement(state, titleOf)}
				</p>
				{state.phase === "idle" && armed && (
					<button
						type="button"
						className="button button-small"
						onClick={() => {
							dispatch({ type: "charged" });
							void open();
						}}
					>
						Open without holding
					</button>
				)}
				{state.phase === "failed" && state.opening && !state.result && (
					<button
						type="button"
						className="button button-primary"
						onClick={() => {
							const opening = openings.find((item) =>
								item.address === state.opening
							);

							if (opening) void finish(opening);
							else refresh();
						}}
					>
						Finish opening
					</button>
				)}
				{result && (state.phase === "revealed" || state.phase === "claiming" ||
					state.phase === "claimed" || state.phase === "failed") &&
					resultPrize && (
					<article
						className="prize-card"
						data-testid="prize-card"
						aria-labelledby="prize-title"
					>
						<p
							className="chip"
							data-tone={resultPrize.tier === "headline" ? "open" : "sealed"}
						>
							{resultPrize.tier === "headline"
								? "Rare prize!"
								: resultPrize.tier === "exclusive"
								? "Something rare"
								: "You won"}
						</p>
						<h3 id="prize-title">{resultPrize.title}</h3>
						{resultPrize.exclusiveAttachment
							? (
								<ExclusivePrize
									rpcUrl={cluster.rpcUrl}
									opening={result.opening}
									attachment={resultPrize.exclusiveAttachment}
									claimed={state.phase === "claimed"}
								/>
							)
							: <p>{resultPrize.lines.join(" + ")}</p>}
						{resultPrize.issuerStock && (
							<p className="fine">{stockDisclaimer(resultPrize.tracks)}</p>
						)}
						{state.phase === "claimed"
							? (
								<p className="notice" role="status">
									Delivered to your wallet.
								</p>
							)
							: (
								<>
									{needsEligibility && (
										<label className="check">
											<input
												type="checkbox"
												checked={eligible}
												onChange={(event) =>
													setEligible(event.currentTarget.checked)}
											/>
											{ELIGIBILITY_STATEMENT}
										</label>
									)}
									<button
										type="button"
										className="button button-primary"
										disabled={busy || (needsEligibility && !eligible)}
										onClick={() => void claim(address(result.opening))}
									>
										{state.phase === "claiming"
											? "Claiming…"
											: "Claim to wallet"}
									</button>
								</>
							)}
						<p className="fine">
							<a href={explorerUrl(cluster, "address", result.opening)}>
								Opening receipt
							</a>
						</p>
					</article>
				)}
			</section>

			{pending.length > 0 && (
				<section className="card" aria-labelledby="pending-title">
					<h2 id="pending-title">Your unfinished openings</h2>
					<ul className="prize-list">
						{pending.map((opening) => (
							<li key={opening.address} className="prize-row">
								<span>
									{opening.data.status === 2
										? prizeFor(opening.data.selectedBundle)?.title ??
											"Your prize"
										: "Waiting for randomness"}
									<small>
										{opening.data.status === 2
											? "Ready to claim"
											: "Box burned, prize not picked yet"}
									</small>
								</span>
								<button
									type="button"
									className="button button-small button-primary"
									disabled={busy}
									onClick={() => {
										if (opening.data.status === 2) {
											dispatch({
												type: "recorded",
												result: resultFor(
													opening.address,
													opening.data.selectedBundle,
													null,
												),
											});
											dispatch({ type: "revealFinished" });
										} else {
											void finish(opening);
										}
									}}
								>
									{opening.data.status === 2 ? "Show prize" : "Finish opening"}
								</button>
							</li>
						))}
					</ul>
				</section>
			)}

			{(boxes ?? 0n) > 0n && (
				<SendBoxes
					client={client}
					template={template}
					max={boxes ?? 0n}
					onSent={refresh}
				/>
			)}

			{steps.length > 0 && (
				<div className="card">
					<TxProgress
						steps={steps}
						cluster={cluster}
						busy={busy}
						title="Transactions"
					/>
				</div>
			)}
			{prizes.some((prize) => prize.issuerStock) && state.phase === "idle" && (
				<p className="fine">
					{stockDisclaimer(prizes.flatMap((prize) => prize.tracks))}
				</p>
			)}
		</div>
	);
}

function SendBoxes(
	{ client, template, max, onSent }: Readonly<{
		client: LootboxClient;
		template: string;
		max: bigint;
		onSent: () => void;
	}>,
) {
	const [recipient, setRecipient] = useState("");
	const [count, setCount] = useState("1");
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const amount = /^\d+$/.test(count) ? BigInt(count) : 0n;
	const valid = isAddress(recipient.trim()) && amount > 0n && amount <= max;

	return (
		<form
			className="card stack"
			aria-labelledby="send-title"
			onSubmit={async (event) => {
				event.preventDefault();

				if (!valid) return;

				setBusy(true);
				setStatus("Approve the transfer in your wallet…");

				try {
					const current = await client.template(address(template));

					await client.transfer(current, address(recipient.trim()), amount);
					setStatus(`Sent ${amount} ${amount === 1n ? "box" : "boxes"}.`);
					setRecipient("");
					onSent();
				} catch (error) {
					setStatus(message(error));
				} finally {
					setBusy(false);
				}
			}}
		>
			<h2 id="send-title">Send a box to a friend</h2>
			<div className="form-grid two">
				<div className="field">
					<label htmlFor="send-to">Their wallet address</label>
					<input
						id="send-to"
						value={recipient}
						autoComplete="off"
						spellCheck={false}
						onChange={(event) => setRecipient(event.currentTarget.value)}
					/>
				</div>
				<div className="field">
					<label htmlFor="send-count">Boxes</label>
					<input
						id="send-count"
						type="number"
						min={1}
						max={max.toString()}
						value={count}
						onChange={(event) => setCount(event.currentTarget.value)}
					/>
				</div>
			</div>
			<button type="submit" className="button" disabled={!valid || busy}>
				Send
			</button>
			{status && <p aria-live="polite">{status}</p>}
		</form>
	);
}
