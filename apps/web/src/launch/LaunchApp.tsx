import { LootboxClient } from "@pina-rs/lootbox";
import { type Address, address, isAddress } from "@solana/kit";
import {
	type FormEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";

import { assetUrl } from "./assets.js";
import { Chest } from "./Chest.js";
import {
	BRAND,
	explorerUrl,
	type LaunchConfig,
	readLaunchConfig,
} from "./config.js";
import {
	initialOpening,
	openingAnnouncement,
	openingReducer,
	type RecordedResult,
} from "./openingMachine.js";
import {
	createPublicOracle,
	type OracleTransport,
	PROOF_TIMEOUT_MS,
} from "./oracle.js";
import {
	buildManifest,
	formatOdds,
	formatUnits,
	formatUsd,
	lineTitle,
	loadPriceBook,
	type ManifestRow,
	PLANNED_EMPTY_COPIES,
	plannedLineup,
	type PriceBook,
	type PrizeLine,
	rowContents,
	rowTitle,
	shortAddress,
	snapshotPriceBook,
} from "./prizes.js";
import {
	commitOpen,
	loadSeries,
	readClient,
	recordedResult,
	type SeriesSnapshot,
	settleThrough,
	unfinishedOpenings,
} from "./series.js";
import {
	type ConnectedWallet,
	type WalletOption,
	watchWallets,
} from "./wallet.js";

type Network = Readonly<{ rpcUrl: string; oracle: OracleTransport | null }>;
type Load<T> =
	| Readonly<{ status: "loading" }>
	| Readonly<{ status: "ready"; value: T }>
	| Readonly<{ status: "error"; message: string }>;

/** The SDK's progress label for prize delivery transactions. */
const CLAIM_LABEL = "Deliver prize bundle batch";

function message(reason: unknown): string {
	return reason instanceof Error ? reason.message : String(reason);
}

function useReducedMotion(): boolean {
	const query = "(prefers-reduced-motion: reduce)";
	const [reduced, setReduced] = useState(() => matchMedia(query).matches);

	useEffect(() => {
		const media = matchMedia(query);
		const update = () => setReduced(media.matches);

		media.addEventListener("change", update);

		return () => media.removeEventListener("change", update);
	}, []);

	return reduced;
}

function useNow(intervalMs = 1_000): number {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), intervalMs);

		return () => clearInterval(timer);
	}, [intervalMs]);

	return now;
}

async function connectNetwork(config: LaunchConfig): Promise<Network> {
	if (config.cluster === "localnet") {
		// Localnet only: the Surfpool control plane and mock oracle stay out of
		// the public bundle's critical path.
		const { connectLocalNetwork } = await import("../lootbox/playground.js");

		return connectLocalNetwork();
	}

	return {
		rpcUrl: config.rpcUrl,
		oracle: createPublicOracle({
			rpcUrl: config.rpcUrl,
			cluster: config.cluster,
		}),
	};
}

export function countdownParts(ms: number): string {
	if (ms <= 0) return "Open now";

	const total = Math.floor(ms / 1000);
	const days = Math.floor(total / 86_400);
	const hours = Math.floor((total % 86_400) / 3_600);
	const minutes = Math.floor((total % 3_600) / 60);
	const seconds = total % 60;

	if (days > 0) return `${days}d ${hours}h ${minutes}m`;

	return `${hours}h ${String(minutes).padStart(2, "0")}m ${
		String(seconds).padStart(2, "0")
	}s`;
}

function PrizeLogo({ line }: Readonly<{ line: PrizeLine }>) {
	if (line.kind === "stock") {
		return (
			<img
				className="prize-logo"
				src={line.stock.logo}
				alt=""
				width={40}
				height={40}
				loading="lazy"
			/>
		);
	}

	if (line.kind === "badge") {
		return (
			<img
				className="prize-logo"
				src={assetUrl("metadata/empty-box.png")}
				alt=""
				width={40}
				height={40}
				loading="lazy"
			/>
		);
	}

	return (
		<span className="prize-logo prize-logo-fallback" aria-hidden="true">
			{line.kind === "sol" ? "◎" : "✦"}
		</span>
	);
}

function lineName(line: PrizeLine): string {
	switch (line.kind) {
		case "stock":
			return line.stock.name;
		case "sol":
			return "Solana";
		case "token":
			return line.label?.name ?? `Token ${shortAddress(line.mint)}`;
		case "badge":
			return "Empty Box badge";
		case "collectible":
			return `Collectible ${shortAddress(line.mint)}`;
	}
}

function ManifestTable(
	{ rows, book }: Readonly<{ rows: readonly ManifestRow[]; book: PriceBook }>,
) {
	return (
		<ol className="manifest" aria-label="Prizes inside the series">
			{rows.map((row) => {
				const first = row.lines[0];
				const depleted = row.remaining === 0n;

				return (
					<li
						key={row.index}
						className="manifest-row"
						data-depleted={depleted ? "true" : "false"}
						data-tier={row.tier}
					>
						{first && <PrizeLogo line={first} />}
						<div className="manifest-name">
							<strong>
								{row.tier === "empty"
									? `Empty box ×${row.copies.toString()}`
									: row.lines.map(lineName).join(" + ")}
							</strong>
							<span>{rowContents(row)}</span>
						</div>
						<div className="manifest-value">
							{row.usdValue === null ? "—" : `≈ ${formatUsd(row.usdValue)}`}
						</div>
						<div className="manifest-copies">
							<span data-testid={`copies-${row.index}`}>
								{row.remaining.toString()}/{row.copies.toString()}
							</span>{" "}
							left
						</div>
						<div className="manifest-odds">
							<span data-testid={`odds-${row.index}`}>
								{formatOdds(row.oddsPercent)}
							</span>
							<span
								className="odds-bar"
								style={{ inlineSize: `${Math.min(100, row.oddsPercent)}%` }}
								aria-hidden="true"
							/>
						</div>
					</li>
				);
			})}
			<li className="manifest-foot">
				Odds are each bundle's share of the boxes still unopened, read from the
				treasury account. They change after every opening.{" "}
				{book.source === "snapshot"
					? `Values use PreStocks prices captured ${
						new Date(book.capturedAt).toLocaleDateString("en-GB", {
							day: "numeric",
							month: "short",
							year: "numeric",
						})
					}.`
					: "Values use live PreStocks prices."}
			</li>
		</ol>
	);
}

function PlannedTable({ book }: Readonly<{ book: PriceBook }>) {
	const lineup = plannedLineup(book);
	const total = lineup.reduce((sum, slice) => sum + slice.copies, 0) +
		PLANNED_EMPTY_COPIES;
	const emptyOdds = PLANNED_EMPTY_COPIES / total * 100;

	return (
		<ol className="manifest" aria-label="Planned prizes">
			{lineup.map((slice) => (
				<li
					key={slice.stock.symbol}
					className="manifest-row"
					data-tier={slice.gbp >= 50 ? "headline" : "standard"}
				>
					<img
						className="prize-logo"
						src={slice.stock.logo}
						alt=""
						width={40}
						height={40}
						loading="lazy"
					/>
					<div className="manifest-name">
						<strong>{slice.stock.name}</strong>
						<span>{slice.stock.symbol} pre-IPO token</span>
					</div>
					<div className="manifest-value">£{slice.gbp}</div>
					<div className="manifest-copies">{slice.copies} box</div>
					<div className="manifest-odds">
						<span>{formatOdds(slice.copies / total * 100)}</span>
						<span
							className="odds-bar"
							style={{ inlineSize: `${slice.copies / total * 100}%` }}
							aria-hidden="true"
						/>
					</div>
				</li>
			))}
			<li className="manifest-row" data-tier="empty">
				<img
					className="prize-logo"
					src={assetUrl("metadata/empty-box.png")}
					alt=""
					width={40}
					height={40}
					loading="lazy"
				/>
				<div className="manifest-name">
					<strong>Empty box ×{PLANNED_EMPTY_COPIES}</strong>
					<span>Empty Box badge + 0.001 SOL</span>
				</div>
				<div className="manifest-value">—</div>
				<div className="manifest-copies">{PLANNED_EMPTY_COPIES} boxes</div>
				<div className="manifest-odds">
					<span>{formatOdds(emptyOdds)}</span>
					<span
						className="odds-bar"
						style={{ inlineSize: `${emptyOdds}%` }}
						aria-hidden="true"
					/>
				</div>
			</li>
			<li className="manifest-foot">
				Planned lineup of about £200 across {total}{" "}
				boxes. The live manifest replaces this once the treasury is funded and
				locked on-chain.
			</li>
		</ol>
	);
}

function PrizeCard(
	props: Readonly<{
		row: ManifestRow | undefined;
		result: RecordedResult;
		phase: "revealed" | "claiming" | "claimed" | "failed";
		claimSignature: string | null;
		config: LaunchConfig;
		rpcUrl: string;
		onClaim(): void;
		onDone(): void;
	}>,
) {
	const { row, result, phase, config } = props;
	const explorer = { cluster: config.cluster, rpcUrl: props.rpcUrl };
	const card = useRef<HTMLElement>(null);

	useEffect(() => {
		// On phones the card lands below the chest; bring the claim into view.
		card.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
	}, []);

	return (
		<section
			ref={card}
			className="prize-card"
			aria-labelledby="prize-card-title"
			data-testid="prize-card"
			data-tier={result.tier}
		>
			<p className="prize-kicker">
				{result.tier === "headline"
					? "Jackpot bundle"
					: result.tier === "empty"
					? "Empty box"
					: "You won"}
			</p>
			<h2 id="prize-card-title">
				{result.tier === "empty"
					? "Empty box — you kept the chest"
					: row
					? rowTitle(row)
					: "Your prize"}
			</h2>
			<ul className="prize-lines">
				{row?.lines.map((line, index) => (
					<li key={index}>
						<PrizeLogo line={line} />
						<span>
							<strong>{lineName(line)}</strong>
							{line.kind === "badge"
								? "Minted to you on claim"
								: lineTitle(line)}
						</span>
						{line.kind === "stock" && (
							<span className="prize-usd">≈ {formatUsd(line.usdValue)}</span>
						)}
					</li>
				))}
			</ul>
			{phase === "claimed"
				? (
					<p className="prize-state" data-testid="prize-state">
						Delivered to your wallet.
					</p>
				)
				: (
					<button
						type="button"
						className="action action-primary"
						onClick={props.onClaim}
						disabled={phase === "claiming"}
					>
						{phase === "claiming" ? "Claiming…" : "Claim to wallet"}
					</button>
				)}
			<p className="prize-receipt">
				Recorded on-chain before this animation played.{" "}
				<a
					href={explorerUrl(explorer, "address", result.opening)}
					target="_blank"
					rel="noreferrer"
				>
					View opening receipt
				</a>
				{result.signature && (
					<>
						{" · "}
						<a
							href={explorerUrl(explorer, "tx", result.signature)}
							target="_blank"
							rel="noreferrer"
						>
							Randomness transaction
						</a>
					</>
				)}
				{props.claimSignature && (
					<>
						{" · "}
						<a
							href={explorerUrl(explorer, "tx", props.claimSignature)}
							target="_blank"
							rel="noreferrer"
						>
							Claim transaction
						</a>
					</>
				)}
			</p>
			{phase === "claimed" && (
				<button type="button" className="action" onClick={props.onDone}>
					Back to the chest
				</button>
			)}
		</section>
	);
}

function Disclosures() {
	return (
		<section className="disclosures" aria-labelledby="disclosures-title">
			<h2 id="disclosures-title">Read before you open</h2>
			<ul>
				<li>
					<strong>Prizes are issuer-controlled tokens.</strong>{" "}
					PreStocks and xStocks issuers can freeze or pause their tokens.
					PreStocks charge an issuer transfer fee, so the amount that lands in
					your wallet on claim can be slightly lower than the bundle amount.
				</li>
				<li>
					<strong>Geo-restrictions apply.</strong>{" "}
					The underlying tokens are not available to everyone, including US
					persons and other restricted jurisdictions. Check the issuer's terms
					before claiming.
				</li>
				<li>
					<strong>Not investment advice.</strong>{" "}
					Boxes are a free giveaway. Values are estimates from issuer prices and
					can go to zero. Nothing here is an offer or a recommendation.
				</li>
				<li>
					<strong>Randomness is verifiable.</strong>{" "}
					Each opening burns one box and commits to Switchboard on-demand
					randomness before the result exists. The oracle's signed reveal is
					verified on-chain, and the prize is allocated first-in, first-out from
					the locked treasury. The animation only replays that recorded result.
				</li>
			</ul>
		</section>
	);
}

function HowItWorks() {
	return (
		<section className="how" aria-labelledby="how-title">
			<h2 id="how-title">How a box works</h2>
			<ol>
				<li>
					<strong>Get a box.</strong>{" "}
					Boxes are free Solana tokens with a fixed supply. Every box is backed
					by a prize already escrowed in the treasury.
				</li>
				<li>
					<strong>Hold it or pass it on.</strong>{" "}
					Before the reveal date a box is an ordinary token. Send it to a friend
					or trade it anywhere tokens trade.
				</li>
				<li>
					<strong>Open it yourself.</strong>{" "}
					After the reveal date, any holder can open. Nobody, including us, can
					pick your prize.
				</li>
				<li>
					<strong>Claim real stock tokens.</strong>{" "}
					Your prize is delivered from escrow straight to your wallet.
				</li>
			</ol>
			<p className="how-why">
				Why Solana: a box, its escrowed prize, the randomness proof, and the
				claim settle in seconds for fractions of a cent, and the stock tokens
				already live here.
			</p>
		</section>
	);
}

export default function LaunchApp() {
	const config = useMemo(
		() => readLaunchConfig(import.meta.env, location.search),
		[],
	);
	const reducedMotion = useReducedMotion();
	const now = useNow();
	const [book, setBook] = useState<PriceBook>(snapshotPriceBook);
	const [network, setNetwork] = useState<Load<Network>>({ status: "loading" });
	const [series, setSeries] = useState<Load<SeriesSnapshot> | null>(null);
	const [options, setOptions] = useState<readonly WalletOption[]>([]);
	const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
	const [balance, setBalance] = useState<bigint | null>(null);
	const [pending, setPending] = useState<Address | null>(null);
	const [opening, dispatch] = useReducer(openingReducer, initialOpening);
	const [claimSignature, setClaimSignature] = useState<string | null>(null);
	const [notice, setNotice] = useState<string>("");
	const [sendTo, setSendTo] = useState("");
	const [sendCount, setSendCount] = useState("1");
	const [sendState, setSendState] = useState<Load<string> | null>(null);
	const inFlight = useRef(false);
	const signatures = useRef<Map<string, string>>(new Map());

	useEffect(() => {
		void loadPriceBook().then(setBook);
	}, []);

	useEffect(() => {
		connectNetwork(config).then(
			(value) => setNetwork({ status: "ready", value }),
			(reason) => setNetwork({ status: "error", message: message(reason) }),
		);
	}, [config]);

	useEffect(() => watchWallets(config.cluster, setOptions), [config.cluster]);

	const rpcUrl = network.status === "ready" ? network.value.rpcUrl : null;
	const oracle = network.status === "ready" ? network.value.oracle : null;
	const treasury = config.treasury;

	const refreshSeries = useCallback(async () => {
		if (!rpcUrl || !treasury) return;

		try {
			const value = await loadSeries(readClient(rpcUrl, treasury), treasury);

			setSeries({ status: "ready", value });
		} catch (reason) {
			setSeries({ status: "error", message: message(reason) });
		}
	}, [rpcUrl, treasury]);

	useEffect(() => {
		if (treasury && rpcUrl) {
			setSeries({ status: "loading" });
			void refreshSeries();
		}
	}, [refreshSeries, rpcUrl, treasury]);

	const snapshot = series?.status === "ready" ? series.value : null;
	const boxMint = snapshot?.template.data.boxMint ?? null;

	const refreshWallet = useCallback(async () => {
		if (!wallet || !rpcUrl || !treasury || !boxMint) {
			setBalance(null);
			return;
		}

		const client = readClient(rpcUrl, treasury);
		const [amount, unfinished] = await Promise.all([
			client.boxBalance(wallet.address, boxMint),
			unfinishedOpenings(client, treasury, wallet.address),
		]);

		setBalance(amount);
		setPending(unfinished[0]?.address ?? null);
	}, [boxMint, rpcUrl, treasury, wallet]);

	useEffect(() => {
		refreshWallet().catch((reason) => setNotice(message(reason)));
	}, [refreshWallet]);

	const rows = useMemo(
		() =>
			snapshot
				? buildManifest(
					snapshot.bundles,
					snapshot.remaining,
					book,
					snapshot.labels,
				)
				: [],
		[snapshot, book],
	);
	const tierOf = useCallback(
		(index: number) =>
			rows.find((row) => row.index === index)?.tier ?? "standard",
		[rows],
	);
	const prizeTitle = useCallback(
		(result: RecordedResult) => {
			const row = rows.find((candidate) =>
				candidate.index === result.bundleIndex
			);

			if (!row) return "a prize";

			return row.tier === "empty" ? rowContents(row) : rowTitle(row);
		},
		[rows],
	);

	const chainNow = now + (snapshot?.clockSkewMs ?? 0);
	const untilReveal = snapshot ? snapshot.revealAt - chainNow : null;
	const revealed = untilReveal !== null && untilReveal <= 0;
	const boxes = balance ?? 0n;

	const blockedReason = (() => {
		if (network.status === "error") return network.message;

		if (!treasury) {
			return "The series goes live soon. Boxes can't be opened yet.";
		}

		if (!snapshot) return "Loading the series…";

		if (!revealed) {
			return `Not yet! Boxes open in ${
				countdownParts(untilReveal ?? 0)
			}. Until then a box is a token you can hold or send.`;
		}

		if (!wallet) return "Connect a wallet that holds a box to open it.";

		if (boxes === 0n) {
			return "This wallet has no boxes. Ask a friend to send you one.";
		}

		if (!oracle) {
			return "The randomness oracle is unavailable right now. Your boxes are safe.";
		}

		return null;
	})();
	const armed = blockedReason === null && opening.phase === "idle";

	const signerClient = useCallback(() => {
		if (!wallet || !rpcUrl) throw new Error("Connect a wallet first");

		return new LootboxClient(rpcUrl, wallet.signer, (label, signature) => {
			if (signature) signatures.current.set(label, signature);
		});
	}, [rpcUrl, wallet]);

	const settle = useCallback(async (client: LootboxClient, target: Address) => {
		if (!oracle) throw new Error("Randomness oracle unavailable");

		const done = await settleThrough(
			client,
			oracle,
			target,
			PROOF_TIMEOUT_MS[config.cluster],
		);
		const signature =
			signatures.current.get("Verify randomness & record prize") ??
				signatures.current.get("Burn box & commit randomness") ?? null;

		dispatch({
			type: "recorded",
			result: recordedResult(done, tierOf, signature),
		});
	}, [config.cluster, oracle, tierOf]);

	const startOpening = useCallback(async () => {
		// Security: one box per charge. A second trigger while a request is in
		// flight must never burn another box.
		if (inFlight.current || !snapshot || !oracle) return;

		inFlight.current = true;
		signatures.current.clear();
		setClaimSignature(null);
		dispatch({ type: "charged" });

		try {
			const client = signerClient();
			const committed = await commitOpen(client, oracle, snapshot.template);

			setPending(committed.address);
			dispatch({
				type: "committed",
				opening: committed.address,
				signature: signatures.current.get("Burn box & commit randomness") ??
					null,
			});
			void refreshWallet();
			await settle(client, committed.address);
		} catch (reason) {
			dispatch({ type: "fail", message: message(reason) });
		} finally {
			inFlight.current = false;
			void refreshSeries();
			void refreshWallet();
		}
	}, [oracle, refreshSeries, refreshWallet, settle, signerClient, snapshot]);

	const resumeOpening = useCallback(async (target: Address) => {
		if (inFlight.current) return;

		inFlight.current = true;
		dispatch({ type: "committed", opening: target, signature: null });

		try {
			await settle(signerClient(), target);
		} catch (reason) {
			dispatch({ type: "fail", message: message(reason) });
		} finally {
			inFlight.current = false;
			void refreshSeries();
		}
	}, [refreshSeries, settle, signerClient]);

	const claim = useCallback(async () => {
		if (!("result" in opening) || !opening.result || inFlight.current) return;

		inFlight.current = true;
		dispatch({ type: "claim" });

		try {
			const client = signerClient();

			signatures.current.delete(CLAIM_LABEL);
			await client.claim(address(opening.result.opening));

			const signature = signatures.current.get(CLAIM_LABEL) ?? null;

			dispatch({ type: "claimed", signature });
			setClaimSignature(signature);
			setPending(null);
		} catch (reason) {
			dispatch({ type: "fail", message: message(reason) });
		} finally {
			inFlight.current = false;
			void refreshWallet();
		}
	}, [opening, refreshWallet, signerClient]);

	const connect = async (option: WalletOption) => {
		try {
			setWallet(await option.connect());
			setNotice("");
		} catch (reason) {
			setNotice(message(reason));
		}
	};

	const disconnect = async () => {
		await wallet?.disconnect();
		setWallet(null);
		setBalance(null);
		setPending(null);
		dispatch({ type: "reset" });
	};

	const send = async (event: FormEvent) => {
		event.preventDefault();

		const recipient = sendTo.trim();
		const count = Number(sendCount);

		if (!isAddress(recipient)) {
			setSendState({
				status: "error",
				message: "Enter a valid Solana address.",
			});
			return;
		}

		if (!Number.isInteger(count) || count < 1 || BigInt(count) > boxes) {
			setSendState({
				status: "error",
				message: `Choose between 1 and ${boxes.toString()} boxes.`,
			});
			return;
		}

		if (!snapshot) return;

		setSendState({ status: "loading" });

		try {
			const signature = await signerClient().transfer(
				snapshot.template,
				address(recipient),
				BigInt(count),
			);

			setSendState({ status: "ready", value: signature });
			setSendTo("");
			void refreshWallet();
		} catch (reason) {
			setSendState({ status: "error", message: message(reason) });
		}
	};

	const airdrop = async () => {
		if (!wallet) return;

		try {
			const { requestLocalFaucet } = await import("../lootbox/playground.js");

			await requestLocalFaucet(wallet.address);
			setNotice("Sent test SOL for fees.");
		} catch (reason) {
			setNotice(message(reason));
		}
	};

	const announcement = opening.phase === "idle"
		? notice
		: openingAnnouncement(opening, prizeTitle);
	const result = "result" in opening ? opening.result : null;
	const cardPhase = opening.phase === "revealed" ||
			opening.phase === "claiming" || opening.phase === "claimed"
		? opening.phase
		: opening.phase === "failed" && result
		? "failed"
		: null;
	const explorer = { cluster: config.cluster, rpcUrl: rpcUrl ?? "" };
	const hint = (() => {
		switch (opening.phase) {
			case "idle":
				return blockedReason ?? "Press and hold the chest to open one box.";
			case "charging":
				return "Keep holding…";
			case "burning":
				return "Approve in your wallet: burn one box and commit randomness.";
			case "rolling":
				return "Box burned. The Switchboard oracle is rolling…";
			case "revealing":
				return "It's opening!";
			case "revealed":
			case "claiming":
			case "claimed":
				return "Recorded on-chain. Claim it below.";
			case "failed":
				return opening.message;
		}
	})();

	let manifest: ReactNode;

	if (!treasury) manifest = <PlannedTable book={book} />;
	else if (series?.status === "error") {
		manifest = <p role="alert" className="error">{series.message}</p>;
	} else if (!snapshot) {
		manifest = <p className="muted">Reading the treasury…</p>;
	} else manifest = <ManifestTable rows={rows} book={book} />;

	return (
		<div className="launch">
			<header className="launch-header">
				<a className="brand" href={assetUrl("")}>
					<span className="brand-mark" aria-hidden="true" />
					{BRAND}
				</a>
				<span className="cluster" data-cluster={config.cluster}>
					{config.cluster === "localnet" ? "Localnet" : config.cluster}
				</span>
				{wallet
					? (
						<button
							type="button"
							className="action action-small"
							onClick={disconnect}
						>
							{shortAddress(wallet.address)} · Disconnect
						</button>
					)
					: <a className="skip-link" href="#wallet">Connect wallet</a>}
			</header>

			<main>
				<section className="hero" aria-labelledby="hero-title">
					<div className="hero-title">
						<p className="eyebrow">
							Free ·{" "}
							{snapshot?.template.data.totalBundles.toString() ?? "limited"}
							{" "}
							boxes · Solana
						</p>
						<h1 id="hero-title">
							A free chest of <em>pre-IPO stock.</em>
						</h1>
					</div>

					<div className="stage" aria-labelledby="stage-title">
						<h2 id="stage-title" className="visually-hidden">Open a box</h2>
						<Chest
							state={opening}
							armed={armed}
							reducedMotion={reducedMotion}
							onHold={(at) => dispatch({ type: "hold", at })}
							onRelease={() => dispatch({ type: "release" })}
							onCharged={() => void startOpening()}
							onBlocked={() => setNotice(blockedReason ?? "")}
							onRevealFinished={() => dispatch({ type: "revealFinished" })}
						/>
						<p
							id="chest-hint"
							className="chest-hint"
							data-phase={opening.phase}
						>
							{hint}
						</p>
						<p
							className="visually-hidden"
							aria-live="polite"
							aria-atomic="true"
							data-testid="announcer"
						>
							{announcement}
						</p>
						<div className="stage-actions">
							{opening.phase === "idle" && armed && (
								<button
									type="button"
									className="action"
									onClick={() => void startOpening()}
								>
									Open without holding
								</button>
							)}
							{opening.phase === "idle" && pending && !armed && wallet && (
								<button
									type="button"
									className="action action-primary"
									onClick={() => void resumeOpening(pending)}
								>
									Resume opening
								</button>
							)}
							{opening.phase === "idle" && pending && armed && (
								<button
									type="button"
									className="action"
									onClick={() => void resumeOpening(pending)}
								>
									Resume unfinished opening
								</button>
							)}
							{opening.phase === "failed" && !result && (
								<>
									{opening.opening && (
										<button
											type="button"
											className="action action-primary"
											onClick={() => {
												if (opening.opening) {
													void resumeOpening(address(opening.opening));
												}
											}}
										>
											Resume opening
										</button>
									)}
									<button
										type="button"
										className="action"
										onClick={() => dispatch({ type: "reset" })}
									>
										Dismiss
									</button>
								</>
							)}
						</div>
						{result && cardPhase && (
							<PrizeCard
								row={rows.find((row) => row.index === result.bundleIndex)}
								result={result}
								phase={cardPhase}
								claimSignature={claimSignature}
								config={config}
								rpcUrl={explorer.rpcUrl}
								onClaim={() => void claim()}
								onDone={() => dispatch({ type: "reset" })}
							/>
						)}
					</div>
					<div className="hero-detail">
						<p className="lede">
							Every box holds real tokenized shares of companies like SpaceX,
							OpenAI and Anthropic, escrowed on-chain. On reveal day, hold the
							chest to crack yours open.
						</p>
						<div className="countdown" aria-live="off">
							<span className="countdown-label">
								{revealed ? "Reveal is live" : "Reveal in"}
							</span>
							<span className="countdown-value" data-testid="countdown">
								{untilReveal === null
									? "Date to be announced"
									: countdownParts(untilReveal)}
							</span>
							{snapshot && (
								<span className="countdown-date">
									{new Date(snapshot.revealAt).toLocaleString("en-GB", {
										dateStyle: "medium",
										timeStyle: "short",
									})}
								</span>
							)}
						</div>
					</div>
				</section>

				<section
					className="wallet-panel"
					id="wallet"
					aria-labelledby="wallet-title"
				>
					<h2 id="wallet-title">Your boxes</h2>
					{wallet
						? (
							<div className="wallet-body">
								<p className="balance">
									<span data-testid="box-balance">
										{balance === null ? "…" : balance.toString()}
									</span>
									<span>
										{balance === 1n ? "box" : "boxes"} in {wallet.name}
									</span>
								</p>
								<p className="muted mono">{wallet.address}</p>
								{config.cluster === "localnet" && (
									<button
										type="button"
										className="action action-small"
										onClick={airdrop}
									>
										Get test SOL for fees
									</button>
								)}
								<form
									className="send"
									onSubmit={send}
									aria-labelledby="send-title"
								>
									<h3 id="send-title">Send a box to a friend</h3>
									<label>
										Friend's Solana address
										<input
											value={sendTo}
											onChange={(event) => setSendTo(event.target.value)}
											autoComplete="off"
											spellCheck={false}
											inputMode="text"
										/>
									</label>
									<label className="send-count">
										Boxes
										<input
											value={sendCount}
											onChange={(event) => setSendCount(event.target.value)}
											inputMode="numeric"
										/>
									</label>
									<button
										type="submit"
										className="action"
										disabled={boxes === 0n || sendState?.status === "loading"}
									>
										{sendState?.status === "loading" ? "Sending…" : "Send"}
									</button>
									<p className="send-status" role="status">
										{sendState?.status === "error" && sendState.message}
										{sendState?.status === "ready" && (
											<>
												Sent.{" "}
												<a
													href={explorerUrl(explorer, "tx", sendState.value)}
													target="_blank"
													rel="noreferrer"
												>
													View transaction
												</a>
											</>
										)}
									</p>
								</form>
							</div>
						)
						: (
							<div className="wallet-body">
								<p className="muted">
									Connect a Solana wallet to see your boxes, send one to a
									friend, or open yours after the reveal.
								</p>
								{options.length === 0
									? (
										<p className="muted" data-testid="no-wallets">
											No Solana wallet found in this browser. Install Phantom,
											Solflare or Backpack, then reload.
										</p>
									)
									: (
										<ul className="wallet-options">
											{options.map((option) => (
												<li key={option.name}>
													<button
														type="button"
														className="action"
														onClick={() => void connect(option)}
													>
														{option.icon && (
															<img
																src={option.icon}
																alt=""
																width={20}
																height={20}
															/>
														)}
														Connect {option.name}
													</button>
												</li>
											))}
										</ul>
									)}
							</div>
						)}
					{notice && opening.phase === "idle" && (
						<p className="notice" role="status">{notice}</p>
					)}
				</section>

				<section className="inside" aria-labelledby="inside-title">
					<div className="section-head">
						<h2 id="inside-title">What's inside</h2>
						{treasury && (
							<a
								href={explorerUrl(explorer, "address", treasury)}
								target="_blank"
								rel="noreferrer"
							>
								Treasury {shortAddress(treasury)}
							</a>
						)}
					</div>
					{manifest}
				</section>

				<HowItWorks />
				<Disclosures />
			</main>

			<footer className="launch-footer">
				<p>
					{BRAND} is built on the open-source Lootbox by Pina program.{" "}
					<a href={assetUrl("playground")}>Creator playground</a>
				</p>
				{snapshot && (
					<p className="muted">
						Remaining prizes{" "}
						{formatUnits(snapshot.template.data.remainingBundles, 0)} of{" "}
						{formatUnits(snapshot.template.data.totalBundles, 0)}
					</p>
				)}
			</footer>
		</div>
	);
}
