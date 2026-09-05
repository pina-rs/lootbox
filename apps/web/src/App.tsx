import {
	bundleAssets,
	type ChainBundle,
	type ChainOpening,
	type ChainTemplate,
	decodeTemplateText,
	MAX_TEMPLATE_BUNDLES,
	remainingTemplateBundleCapacity,
	templateInventory,
	templateMintCapacity,
} from "@pina-rs/lootbox";
import { type Address, address, type ReadonlyUint8Array } from "@solana/kit";
import {
	ArrowDownToLine,
	ArrowRight,
	Box,
	Check,
	ChevronDown,
	Copy,
	Gift,
	Hammer,
	Plus,
	RefreshCw,
	ShieldCheck,
	Tag,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssetPicker } from "./lootbox/AssetPicker.js";
import { LootboxMachine, type MachinePhase } from "./lootbox/Machine.js";
import { MarketDesk } from "./lootbox/MarketDesk.js";
import {
	appendDrop,
	cancelSavedDraft,
	connectPlayground,
	createDrop,
	creatorErrors,
	type CreatorInput,
	type DraftAsset,
	formatUnits,
	initialInput,
	makeAsset,
	makeBundle,
	parseUnits,
	type Playground,
	previewInput,
	savedDraftInfo,
	settleOpenings,
	validateInput,
} from "./lootbox/playground.js";
import { UnlockDatePicker } from "./lootbox/UnlockDatePicker.js";

type Workspace = {
	templates: ChainTemplate[];
	openings: ChainOpening[];
	bundles: ChainBundle[];
	selected: ChainTemplate | null;
	boxes: bigint;
	creatorBoxes: bigint;
	supply: bigint;
	balance: bigint;
	chainTime: bigint;
	chainSlot: bigint;
};
const empty: Workspace = {
	templates: [],
	openings: [],
	bundles: [],
	selected: null,
	boxes: 0n,
	creatorBoxes: 0n,
	supply: 0n,
	balance: 0n,
	chainTime: 0n,
	chainSlot: 0n,
};
const short = (value: string) => `${value.slice(0, 5)}…${value.slice(-5)}`;
const shortHash = (value: ReadonlyUint8Array) => {
	if (Array.from(value).every((byte) => byte === 0)) {
		return "Locks with treasury";
	}
	const hex = Array.from(value, (byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	return `${hex.slice(0, 10)}…${hex.slice(-10)}`;
};
const errorMessage = (error: unknown) =>
	error instanceof Error
		? error.message
		: "Something went wrong. Refresh chain state and retry.";
const statusName = (status: number, lockedAt = 0n) =>
	lockedAt > 0n
		? "Market locked"
		: status === 0
		? "Draft"
		: status === 1
		? "Live · editable"
		: "Retired · recovery";

function prizeName(bundle: ChainBundle) {
	const assets = bundleAssets(bundle.data);
	const uniqueKinds = new Set(["nft", "metadataNft", "core", "compressedNft"]);
	const nfts =
		assets.filter((asset) => uniqueKinds.has(asset.kind ?? "")).length;
	return [
		...assets.filter((asset) => !uniqueKinds.has(asset.kind ?? "")).map((
			asset,
		) =>
			`${
				formatUnits(asset.amount, asset.kind === "sol" ? 9 : asset.decimals)
			} ${asset.kind === "sol" ? "SOL" : "tokens"}`
		),
		...(nfts ? [`${nfts} exclusive NFT${nfts > 1 ? "s" : ""}`] : []),
	].join(" + ");
}

export default function App() {
	const [sandbox, setSandbox] = useState<Playground | null>(null);
	const [workspace, setWorkspace] = useState<Workspace>(empty);
	const [tab, setTab] = useState<"receive" | "create" | "guide">("receive");
	const [input, setInput] = useState<CreatorInput>(initialInput);
	const [creatorMode, setCreatorMode] = useState<"create" | "append">("create");
	const [pickerFor, setPickerFor] = useState<number | null>(null);
	const [hasDraft, setHasDraft] = useState(false);
	const [busy, setBusy] = useState(false);
	const [connecting, setConnecting] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [phase, setPhase] = useState<MachinePhase>("received");
	const [revealed, setRevealed] = useState<Set<string>>(new Set());
	const [giftAmount, setGiftAmount] = useState("1");
	const [destination, setDestination] = useState("");
	const [lockAcknowledged, setLockAcknowledged] = useState(false);
	const [transactions, setTransactions] = useState<
		{ label: string; signature: string }[]
	>([]);
	const selectedId = useRef<Address | undefined>(undefined);
	const pendingAction = useRef(false);

	const refresh = useCallback(
		async (session: Playground, selection = selectedId.current) => {
			const client = session.client("recipient");
			const { templates, openings } = await client.inventory();
			const selected = templates.find((item) => item.address === selection) ??
				templates.find((item) =>
					item.data.authority === session.creator.address
				) ??
				templates[0] ?? null;
			const [bundles, boxes, creatorBoxes, supply, balance, slot] =
				await Promise.all([
					selected ? client.bundles(selected) : [],
					selected
						? client.boxBalance(
							session.recipient.address,
							selected.data.boxMint,
						)
						: 0n,
					selected
						? client.boxBalance(session.creator.address, selected.data.boxMint)
						: 0n,
					selected
						? client.rpc.getTokenSupply(selected.data.boxMint, {
							commitment: "processed",
						}).send().then((response) => BigInt(response.value.amount))
						: 0n,
					client.rpc.getBalance(session.recipient.address, {
						commitment: "processed",
					}).send(),
					client.rpc.getSlot({ commitment: "processed" }).send(),
				]);
			const chainTime = await client.rpc.getBlockTime(slot).send();
			selectedId.current = selected?.address;
			if (selected) {
				localStorage.setItem(
					`lootbox:selected:${session.config.instanceId}`,
					selected.address,
				);
			}
			setWorkspace({
				templates,
				openings,
				selected,
				bundles,
				boxes,
				creatorBoxes,
				supply,
				balance: balance.value,
				chainTime: chainTime ?? 0n,
				chainSlot: slot,
			});
		},
		[],
	);

	const connect = useCallback(async () => {
		setConnecting(true);
		setError("");
		try {
			const session = await connectPlayground();
			setSandbox(session);
			setDestination(session.recipient.address);
			const saved = localStorage.getItem(
				`lootbox:selected:${session.config.instanceId}`,
			);
			selectedId.current = saved ? address(saved) : undefined;
			const draft = savedDraftInfo(session);
			if (draft) {
				setInput(draft.input);
				setCreatorMode(draft.mode);
				if (draft.template) selectedId.current = address(draft.template);
				setHasDraft(true);
				setTab("create");
			}
			await refresh(session);
		} catch (reason) {
			setError(errorMessage(reason));
		} finally {
			setConnecting(false);
		}
	}, [refresh]);
	useEffect(() => void connect(), [connect]);
	useEffect(() => setLockAcknowledged(false), [workspace.selected?.address]);
	useEffect(() => {
		if (!sandbox || busy) return;
		const timer = setInterval(
			() =>
				void refresh(sandbox).catch((reason: unknown) =>
					setError(errorMessage(reason))
				),
			5000,
		);
		return () => clearInterval(timer);
	}, [sandbox, busy, refresh]);

	const progress = (label: string, signature?: string) => {
		setNotice(label);
		if (label.startsWith("Burn")) setPhase(signature ? "burn" : "commit");
		if (label.startsWith("Verify") || label.startsWith("Record")) {
			setPhase("reveal");
		}
		if (signature) {
			setTransactions((items) => [{ label, signature }, ...items].slice(0, 24));
		}
	};
	const run = async (action: (session: Playground) => Promise<void>) => {
		if (!sandbox || pendingAction.current) return;
		pendingAction.current = true;
		setBusy(true);
		setError("");
		setNotice("");
		try {
			await action(sandbox);
		} catch (reason) {
			setError(errorMessage(reason));
		} finally {
			try {
				await refresh(sandbox);
				setHasDraft(savedDraftInfo(sandbox) !== null);
			} catch (reason) {
				setError(errorMessage(reason));
			}
			setBusy(false);
			pendingAction.current = false;
		}
	};

	const selected = workspace.selected;
	const preview = previewInput(input);
	const bundleBudget = creatorMode === "append"
		? selected ? remainingTemplateBundleCapacity(selected.data.bundleCount) : 0
		: MAX_TEMPLATE_BUNDLES;
	const exceedsBundleBudget = input.rows.length > bundleBudget;
	const fieldErrors = creatorErrors(input);
	const errorProps = (key: string) => ({
		"aria-invalid": Boolean(fieldErrors[key]),
		"aria-describedby": fieldErrors[key] ? `error-${key}` : undefined,
	});
	const fieldError = (key: string) =>
		fieldErrors[key]
			? (
				<span id={`error-${key}`} className="field-error">
					{fieldErrors[key]}
				</span>
			)
			: null;
	const receipts = workspace.openings.filter((item) =>
		item.data.template === selected?.address &&
		item.data.beneficiary === sandbox?.recipient.address
	).sort((a, b) => a.data.sequence > b.data.sequence ? -1 : 1);
	const receipt = receipts.find((item) => item.data.status < 3) ?? receipts[0];
	const delivered = receipt?.data.status === 3;
	const visiblePrize = receipt && receipt.data.status >= 2 &&
		(revealed.has(receipt.address) || delivered);
	const prize = visiblePrize
		? workspace.bundles[receipt.data.selectedBundle]
		: undefined;
	const capacity = selected
		? templateMintCapacity(selected.data, workspace.supply)
		: 0n;
	const inventory = selected ? templateInventory(selected.data) : [];
	const treasuryLocked = Boolean(selected && selected.data.lockedAt > 0n);
	const revealPending = Boolean(
		selected && selected.data.opensAt > workspace.chainTime,
	);
	const recoveryRetired = Boolean(
		selected && selected.data.status === 2 && !treasuryLocked,
	);
	const holderOpenable = treasuryLocked || recoveryRetired;
	const recoveryAvailable = Boolean(
		selected && selected.data.status === 1 && !treasuryLocked && !revealPending,
	);
	const isCreator = selected?.data.authority === sandbox?.creator.address;
	const recoverySlots = receipt?.data.status === 0 &&
			receipt.data.seedSlot + 300n > workspace.chainSlot
		? receipt.data.seedSlot + 300n - workspace.chainSlot
		: 0n;
	const forfeitable = receipt?.data.status === 0 && selected &&
		receipt.data.sequence === selected.data.nextAllocation &&
		recoverySlots === 0n;
	const effectivePhase: MachinePhase = busy
		? phase
		: visiblePrize
		? delivered ? "redeemed" : "revealed"
		: phase === "received"
		? "received"
		: "idle";
	const updateRow = (
		index: number,
		patch: Partial<CreatorInput["rows"][number]>,
	) =>
		setInput((value) => ({
			...value,
			rows: value.rows.map((row, position) =>
				index === position ? { ...row, ...patch } : row
			),
		}));
	const updateAsset = (
		rowIndex: number,
		assetIndex: number,
		patch: Partial<DraftAsset>,
	) =>
		setInput((value) => ({
			...value,
			rows: value.rows.map((row, position) =>
				position !== rowIndex ? row : {
					...row,
					assets: row.assets.map((asset, current) =>
						current === assetIndex ? { ...asset, ...patch } : asset
					),
				}
			),
		}));
	const beginAppend = () => {
		if (!selected) return;
		if (selected.data.lockedAt > 0n) {
			setError(
				"This treasury is permanently locked and cannot accept additions.",
			);
			return;
		}
		setCreatorMode("append");
		setInput({
			name: decodeTemplateText(selected.data.name),
			uri: decodeTemplateText(selected.data.uri),
			opensAt: selected.data.opensAt > 0n
				? new Date(
					Number(selected.data.opensAt) * 1000 -
						new Date().getTimezoneOffset() * 60_000,
				).toISOString().slice(0, 16)
				: "",
			resultReceiptsEnabled: selected.data.resultReceiptsEnabled,
			settlementBountySol: formatUnits(
				selected.data.settlementBountyLamports,
				9,
			),
			rows: [makeBundle()],
		});
		setTab("create");
	};
	const copy = (value: string) =>
		void navigator.clipboard.writeText(value).then(
			() => setNotice("Address copied"),
			() =>
				setError("Clipboard unavailable. Select and copy the address below."),
		);

	return (
		<div className="workshop-shell">
			<a className="skip-link" href="#main">Skip to workspace</a>
			<header className="workshop-header">
				<a
					href="#"
					className="workshop-brand"
					onClick={(event) => {
						event.preventDefault();
						setTab("receive");
					}}
				>
					<Box size={27} />
					<span>
						LOOTBOX<small>A PRIMITIVE BY PINA</small>
					</span>
				</a>
				<nav aria-label="Workspace">
					{([["receive", "Open a gift", Gift], ["create", "Workshop", Hammer], [
						"guide",
						"How it works",
						ShieldCheck,
					]] as const).map(([value, label, Icon]) => (
						<button
							key={value}
							aria-current={tab === value ? "page" : undefined}
							onClick={() => setTab(value)}
						>
							<Icon size={16} />
							{label}
						</button>
					))}
				</nav>
				<div className="connection">
					<i className={sandbox ? "is-online" : ""} />
					{connecting
						? "Connecting…"
						: sandbox
						? "SURFPOOL · LOCAL"
						: "SANDBOX OFFLINE"}
				</div>
			</header>
			<div className="test-banner">
				Real local transactions. Catalog data may be live; funded assets are
				test-only.<a
					href="#guide"
					onClick={(event) => {
						event.preventDefault();
						setTab("guide");
					}}
				>
					Know the limits <ArrowRight size={13} />
				</a>
			</div>
			<main id="main">
				<p
					className="sr-only"
					role="status"
					aria-live="polite"
					aria-atomic="true"
					data-testid="prize-announcement"
				>
					{prize
						? `Recorded prize: ${prizeName(prize)}. ${
							delivered
								? "All assets delivered to your test wallet."
								: "Not yet claimed. Choose Claim your winnings to receive it."
						}`
						: ""}
				</p>
				{error && (
					<div className="feedback feedback--error" role="alert">
						<strong>That step needs attention.</strong>
						<p>{error}</p>
						<button
							onClick={() =>
								sandbox
									? void run(async (session) => {
										await refresh(session);
										setNotice(
											"Chain state refreshed. Resume the unfinished action below.",
										);
									})
									: void connect()}
							disabled={busy || connecting}
						>
							<RefreshCw size={15} />
							{sandbox ? "Refresh chain state" : "Retry connection"}
						</button>
						{!sandbox && (
							<p>
								Start <code>devenv shell -- pnpm playground:rpc</code>{" "}
								in the repository, then retry.
							</p>
						)}
					</div>
				)}
				{notice && (
					<div className="feedback feedback--status" role="status">
						{busy
							? <RefreshCw className="spin" size={16} />
							: <Check size={16} />}
						{notice}
					</div>
				)}

				{tab === "receive" && (
					<>
						<div className="workspace-title">
							<div>
								<h1>
									{visiblePrize
										? delivered ? "Cargo secured." : "Good things inside."
										: "A little unknown."}
								</h1>
								<p>
									{visiblePrize
										? delivered
											? selected?.data.resultReceiptsEnabled
												? "Your prize is in your test wallet. Its immutable integration result stays on-chain."
												: "Your prize is in your test wallet. Recover the temporary opening rent when ready."
											: "The result is recorded. Claim it whenever you’re ready."
										: "A sealed gift. A real treasury. One moment of discovery."}
								</p>
							</div>
							<button
								className="quiet-button"
								onClick={() => {
									setCreatorMode("create");
									setTab("create");
								}}
							>
								<Plus size={17} />Create a treasury
							</button>
						</div>
						<section className="opening-workbench" aria-label="Gift workspace">
							<aside className="drop-drawer">
								<h2>Your opening table</h2>
								<label className="field">
									Treasury<div className="select-wrap">
										<select
											aria-label="Choose template"
											value={selected?.address ?? ""}
											disabled={!sandbox || busy || !workspace.templates.length}
											onChange={(event) => {
												setPhase("received");
												if (sandbox) {
													void run((session) =>
														refresh(session, address(event.target.value))
													);
												}
											}}
										>
											<option value="" disabled>No treasuries yet</option>
											{workspace.templates.map((item) => (
												<option key={item.address} value={item.address}>
													{decodeTemplateText(item.data.name)} · {statusName(
														item.data.status,
														item.data.lockedAt,
													).toLowerCase()}
												</option>
											))}
										</select>
										<ChevronDown size={16} />
									</div>
								</label>
								<div className="ticket-count">
									<Box size={24} />
									<strong data-testid="box-balance">
										{workspace.boxes.toString()}
									</strong>
									<span>
										sealed gifts<br />in your test wallet
									</span>
								</div>
								<dl className="facts">
									<div>
										<dt>Reveal date</dt>
										<dd>
											{selected?.data.opensAt
												? new Date(Number(selected.data.opensAt) * 1000)
													.toLocaleString()
												: "Immediately"}
										</dd>
									</div>
									<div>
										<dt>Treasury</dt>
										<dd>
											{selected
												? `${
													statusName(
														selected.data.status,
														selected.data.lockedAt,
													)
												} · revision ${selected.data.revision}`
												: "—"}
										</dd>
									</div>
									<div>
										<dt>Open queue</dt>
										<dd>
											{selected?.data.pendingOpenings.toString() ?? "0"} pending
										</dd>
									</div>
									<div>
										<dt>Bundle types</dt>
										<dd>{selected?.data.bundleCount.toString() ?? "0"}</dd>
									</div>
									<div>
										<dt>Bundle copies</dt>
										<dd>{selected?.data.totalBundles.toString() ?? "0"}</dd>
									</div>
									<div>
										<dt>Unwon copies</dt>
										<dd>{selected?.data.remainingBundles.toString() ?? "0"}</dd>
									</div>
									<div>
										<dt>Box supply</dt>
										<dd>
											{workspace.supply.toString()} /{" "}
											{selected?.data.totalBundles.toString() ?? "0"}
										</dd>
									</div>
									<div>
										<dt>Gift token</dt>
										<dd>Token-2022 · 0 decimals</dd>
									</div>
									<div>
										<dt>Result receipts</dt>
										<dd>
											{selected?.data.resultReceiptsEnabled
												? "Permanent · creator prepaid"
												: "Off · no receipt rent"}
										</dd>
									</div>
									<div>
										<dt>Manifest hash</dt>
										<dd>
											{selected ? shortHash(selected.data.manifestHash) : "—"}
										</dd>
									</div>
								</dl>
								{sandbox && (
									<details className="wallet-details">
										<summary>Recipient test wallet</summary>
										<button
											className="address-button"
											onClick={() => copy(sandbox.recipient.address)}
										>
											<code>{sandbox.recipient.address}</code>
											<Copy size={14} />
										</button>
										<p data-testid="sol-balance">
											{formatUnits(workspace.balance)} test SOL
										</p>
										<button
											className="quiet-button"
											disabled={busy}
											onClick={() =>
												void run(async (session) => {
													await session.faucet("recipient");
													setNotice("Recipient reset to 100 test SOL");
												})}
										>
											Reset test SOL
										</button>
									</details>
								)}
							</aside>
							<div className="opening-stage">
								<div className="crate-caption">
									<span>
										{selected
											? decodeTemplateText(selected.data.name)
											: "YOUR NEXT GOOD SURPRISE"}
									</span>
									<span>
										{selected ? short(selected.address) : "SEALED / UNKNOWN"}
									</span>
								</div>
								<LootboxMachine phase={effectivePhase} />
								{prize && (
									<div className="prize-reveal" data-testid="prize-reveal">
										<h2>{prizeName(prize)}</h2>
										<p>
											{delivered
												? "Delivered to your wallet"
												: "Allocated to you · no rerolls"}
										</p>
									</div>
								)}
								<div className="opening-action">
									{!selected
										? (
											<>
												<p>
													Start with a treasury. Pack it with possibilities.
												</p>
												<button
													className="primary-button"
													disabled={!sandbox || connecting}
													onClick={() => setTab("create")}
												>
													<Hammer size={18} />Build your first drop
												</button>
											</>
										)
										: receipt && receipt.data.status < 2
										? (
											<>
												<p>
													{forfeitable
														? "The oracle window expired. You may forfeit this burned box to unblock later receipts. It is not returned, because that would create a reroll exploit."
														: "Your box is burned. Its opening record is safe on-chain."}
												</p>
												{forfeitable
													? (
														<button
															className="primary-button"
															disabled={busy}
															onClick={() =>
																void run(async (session) => {
																	await session.client("recipient", progress)
																		.forfeitTemplateOpen(selected, receipt);
																	setPhase("received");
																	setNotice(
																		"Expired opening forfeited. No prize inventory was consumed, and the queue can continue.",
																	);
																})}
														>
															Forfeit & unblock queue<RefreshCw size={18} />
														</button>
													)
													: (
														<button
															className="primary-button"
															disabled={busy}
															onClick={() =>
																void run(async (session) => {
																	await settleOpenings(
																		session,
																		selected,
																		progress,
																	);
																	setNotice(
																		"Prize recorded. Click to reveal it.",
																	);
																})}
														>
															{busy
																? "Recording your prize…"
																: "Resume opening"}
															<ArrowRight size={18} />
														</button>
													)}
											</>
										)
										: receipt && receipt.data.status === 2
										? (
											<button
												className="primary-button"
												disabled={busy}
												onClick={() =>
													visiblePrize
														? void run(async (session) => {
															await session.client("recipient", progress).claim(
																receipt.address,
															);
															setNotice(
																"All prize assets delivered to your test wallet",
															);
														})
														: (setRevealed((value) =>
															new Set([...value, receipt.address])
														),
															setPhase("revealed"))}
											>
												{busy
													? "Delivering cargo…"
													: visiblePrize
													? "Claim your winnings"
													: "Reveal your winnings"}
												<ArrowDownToLine size={18} />
											</button>
										)
										: (
											<>
												<button
													className="primary-button"
													disabled={busy || workspace.boxes === 0n ||
														!holderOpenable || revealPending ||
														selected.data.status === 0}
													onClick={() =>
														void run(async (session) => {
															await session.client("recipient", progress)
																.requestOpen(selected, session.config.oracle);
															await settleOpenings(session, selected, progress);
															setNotice("Prize recorded. The reveal is yours.");
														})}
												>
													{busy
														? "Opening your gift…"
														: !holderOpenable
														? "Treasury must be locked"
														: revealPending
														? "Waiting for the reveal date"
														: delivered && workspace.boxes > 0n
														? "Open another gift"
														: workspace.boxes === 0n
														? "No sealed gifts yet"
														: selected.data.status === 0
														? "Treasury is still a draft"
														: "Open a gift"}
													<ArrowRight size={18} />
												</button>
												<p>
													{!holderOpenable
														? "The creator must fix supply and revoke mint authority before any box can reveal."
														: recoveryRetired
														? "This missed-deadline series is retired. Existing holders may still open, but it is not market-locked."
														: revealPending
														? "You can still transfer this gift before its reveal date."
														: "The owner pays to burn and request randomness. Anyone may verify and allocate in queue order."}
												</p>
											</>
										)}
								</div>
								<ol className="opening-steps" aria-label="Opening steps">
									<li className={receipt ? "done" : ""}>Burn & commit</li>
									<li
										className={receipt && receipt.data.status >= 2
											? "done"
											: ""}
									>
										Record prize
									</li>
									<li className={visiblePrize ? "done" : ""}>Reveal</li>
									<li className={delivered ? "done" : ""}>Claim</li>
								</ol>
								{receipt && (
									<p className="snapshot-note">
										Receipt #{receipt.data.sequence.toString()}{" "}
										· treasury revision{" "}
										{receipt.data.treasuryRevision.toString()} ·{" "}
										{receipt.data.eligibleBundleCount}{" "}
										eligible bundles{receipt.data.status === 0 && !forfeitable
											? recoverySlots > 0n
												? ` · timeout option in ${recoverySlots.toString()} slots`
												: " · waiting for the earlier receipt"
											: ""}
									</p>
								)}
								{selected && receipt && delivered && (
									<button
										type="button"
										className="receipt-close"
										disabled={busy}
										onClick={() =>
											void run(async (session) => {
												await session.client("recipient", progress)
													.closeTemplateOpening(
														selected,
														receipt,
														session.config.oracle,
													);
												setRevealed((items) => {
													const next = new Set(items);
													next.delete(receipt.address);
													return next;
												});
												setNotice(
													"Receipt closed and its account rent returned.",
												);
											})}
									>
										Close receipt & recover rent
									</button>
								)}
							</div>
							<aside className="prize-manifest">
								<h2>What’s in the treasury?</h2>
								<p>
									{treasuryLocked ? "Fixed" : "Latest"} odds · revision{" "}
									{selected?.data.revision.toString() ?? "—"}
								</p>
								{workspace.bundles.length
									? (
										<ol>
											{workspace.bundles.map((bundle, index) => {
												const item = inventory[index];
												return (
													<li
														key={bundle.address}
														className={item?.remaining === 0n
															? "is-depleted"
															: ""}
													>
														<div>
															<strong>{prizeName(bundle)}</strong>
															<span>
																Bundle #{index + 1} ·{" "}
																{item?.remaining.toString()} left
															</span>
														</div>
														<b>{item?.probabilityPercent.toFixed(2)}%</b>
														<div className="odds-line">
															<i
																style={{
																	transform: `scaleX(${
																		(item?.probabilityPercent ?? 0) / 100
																	})`,
																}}
															/>
														</div>
														<details>
															<summary>Inspect asset IDs</summary>
															{bundleAssets(bundle.data).filter((asset) =>
																asset.kind !== "sol"
															).map((asset) => (
																<code key={asset.index}>
																	{(asset.kind ?? "asset").toUpperCase()}{" "}
																	{asset.mint}
																</code>
															))}
															<code>Escrow {bundle.address}</code>
														</details>
													</li>
												);
											})}
										</ol>
									)
									: (
										<div className="manifest-empty">
											<Box size={32} />
											<p>No active prizes yet.</p>
											<span>
												Draft bundles cannot be drawn until every asset is
												funded.
											</span>
										</div>
									)}
								<p className="manifest-note">
									{treasuryLocked
										? "Every remaining copy is one equal ticket. Supply and inventory are permanently fixed; each reveal burns one box and removes one outcome."
										: recoveryRetired
										? "This series missed its market lock. Retirement freezes creator changes so existing holders can still reveal; surplus outcomes remain escrowed until every box and opening is gone."
										: "Every bundle copy is one equal ticket. The creator may still add prizes; no box can open until supply and inventory are permanently locked."}
								</p>
							</aside>
						</section>
						{selected && (
							<section className="dispatch">
								{holderOpenable
									? (
										<>
											<div className="dispatch-heading">
												<div>
													<h2>
														{treasuryLocked
															? "Distribute the fixed series."
															: "Preserve the recovery series."}
													</h2>
													<p>
														The creator holds{" "}
														{workspace.creatorBoxes.toString()} of{" "}
														{workspace.supply.toString()}{" "}
														live boxes. Every send is a standard transfer;
														creator issuance and treasury changes are
														permanently disabled.
													</p>
												</div>
												<span className="lock-stamp">
													<ShieldCheck size={17} />
													{treasuryLocked ? "FIXED SUPPLY" : "RECOVERY SEALED"}
												</span>
											</div>
											<div className="dispatch-fields">
												<label className="field">
													Recipient address<input
														aria-label="Recipient address"
														value={destination}
														onChange={(event) =>
															setDestination(event.target.value)}
														disabled={busy}
														spellCheck={false}
													/>
												</label>
												<label className="field field--amount">
													Boxes<input
														aria-label="Boxes"
														type="number"
														min="1"
														step="1"
														value={giftAmount}
														onChange={(event) =>
															setGiftAmount(event.target.value)}
														disabled={busy}
													/>
												</label>
												<button
													className="primary-button"
													disabled={busy || !isCreator ||
														workspace.creatorBoxes === 0n}
													onClick={() =>
														void run(async (session) => {
															await session.client("creator", progress)
																.transfer(
																	selected,
																	address(destination),
																	parseUnits(giftAmount, 0),
																);
															setPhase("received");
															setNotice("Whole sealed boxes transferred");
														})}
												>
													<Gift size={18} />Send sealed boxes
												</button>
											</div>
											{isCreator && treasuryLocked && (
												<details>
													<summary>Creator lifecycle controls</summary>
													<p>
														Retirement stops lifecycle changes but preserves
														holder transfers, reveals, and claims. Optional
														service funding can be recovered only after supply
														and pending openings reach zero.
													</p>
													{selected.data.status !== 2
														? (
															<button
																className="quiet-button"
																disabled={busy}
																onClick={() =>
																	void run(async (session) => {
																		await session.client("creator", progress)
																			.retireTemplate(selected);
																		setNotice(
																			"Treasury retired; holder rights remain available.",
																		);
																	})}
															>
																Retire treasury
															</button>
														)
														: (selected.data.resultReceiptsEnabled ||
															selected.data.settlementBountyLamports > 0n) && (
															<button
																className="quiet-button"
																disabled={busy || workspace.supply !== 0n ||
																	selected.data.pendingOpenings !== 0n}
																onClick={() =>
																	void run(async (session) => {
																		await session.client("creator", progress)
																			.closeServiceVault(selected);
																		setNotice(
																			"Unused service funding returned to the creator.",
																		);
																	})}
															>
																Recover unused service funding
															</button>
														)}
												</details>
											)}
											<details>
												<summary>
													Transfer boxes from the recipient wallet
												</summary>
												<p>
													The recipient currently holds{" "}
													{workspace.boxes.toString()}. Transfers preserve the
													sealed outcome and do not touch inventory.
												</p>
												<button
													className="quiet-button"
													disabled={busy || workspace.boxes === 0n}
													onClick={() =>
														void run(async (session) => {
															await session.client("recipient", progress)
																.transfer(
																	selected,
																	address(destination),
																	parseUnits(giftAmount, 0),
																);
															setNotice("Whole sealed boxes transferred");
														})}
												>
													Transfer recipient boxes <ArrowRight size={15} />
												</button>
											</details>
										</>
									)
									: (
										<div className="lock-console">
											<div className="dispatch-heading">
												<div>
													<h2>
														{recoveryAvailable
															? "Seal a missed deadline."
															: "Fix the market supply."}
													</h2>
													<p>
														{recoveryAvailable
															? "The reveal date passed before market lock. Retirement permanently stops creator changes while preserving every issued holder claim."
															: `${selected.data.bundleCount} bundle types contain ${selected.data.totalBundles} copies. Locking mints${
																capacity === 0n
																	? " no additional"
																	: ` ${capacity}`
															} boxes so fixed issuance is exactly ${selected.data.totalBundles}.`}
													</p>
												</div>
												{isCreator && !recoveryAvailable && (
													<button
														type="button"
														className="quiet-button"
														onClick={beginAppend}
														disabled={busy}
													>
														<Plus size={16} />Add prizes before locking
													</button>
												)}
											</div>
											{recoveryAvailable
												? (
													<>
														<button
															className="primary-button lock-button"
															disabled={busy || !isCreator}
															onClick={() =>
																void run(async (session) => {
																	await session.client("creator", progress)
																		.retireTemplate(selected);
																	setNotice(
																		"Recovery sealed. Existing boxes can now reveal; this series is not market-certified.",
																	);
																})}
														>
															<ShieldCheck size={18} />Retire & preserve claims
														</button>
														<p className="lock-disclosure">
															Recovery does not create a tradable fixed-supply
															market. Surplus prizes stay escrowed until live
															box supply and pending openings both reach zero.
														</p>
													</>
												)
												: (
													<>
														<div
															className="supply-equation"
															aria-label="Fixed supply equation"
														>
															<span>
																<b>{selected.data.totalBundles.toString()}</b>
																{" "}
																funded bundle copies
															</span>
															<i>=</i>
															<span>
																<b>{selected.data.totalBundles.toString()}</b>
																{" "}
																indivisible boxes
															</span>
														</div>
														<label className="risk-check">
															<input
																type="checkbox"
																checked={lockAcknowledged}
																onChange={(event) =>
																	setLockAcknowledged(event.target.checked)}
																disabled={busy || !isCreator}
															/>
															<span>
																I understand this permanently freezes prizes and
																supply, boxes may be worth less than paid, and I
																meet the eligibility rules that apply to me.
															</span>
														</label>
														<button
															className="primary-button lock-button"
															disabled={busy || !isCreator ||
																!lockAcknowledged ||
																selected.data.status !== 1 || !revealPending}
															onClick={() =>
																void run(async (session) => {
																	await session.client("creator", progress)
																		.lockTreasury(
																			selected,
																			session.creator.address,
																		);
																	setLockAcknowledged(false);
																	setNotice(
																		"Treasury and exact box supply locked. The series is ready to trade.",
																	);
																})}
														>
															<ShieldCheck size={18} />
															{busy
																? "Locking treasury…"
																: capacity === 0n
																? "Lock exact supply"
																: `Mint ${capacity} & lock treasury`}
														</button>
														<p className="lock-disclosure">
															Requires a future reveal date, pristine inventory,
															no opening history, and no staged bundle. The
															program rechecks all four.
														</p>
													</>
												)}
										</div>
									)}
							</section>
						)}
						{selected && treasuryLocked && (
							<MarketDesk
								template={selected}
								bundles={workspace.bundles}
								supply={workspace.supply}
								chainTime={workspace.chainTime}
							/>
						)}
					</>
				)}

				{tab === "create" && (
					<>
						<div className="workspace-title">
							<div>
								<h1>
									{creatorMode === "append"
										? "Restock the unknown."
										: "Pack the possibilities."}
								</h1>
								<p>
									{creatorMode === "append"
										? "Fund new bundles, then publish them as the next treasury revision."
										: "Each funded bundle becomes one or more fair tickets in the draw."}
								</p>
							</div>
							<span className="mode-label">
								<ShieldCheck size={16} />Append-only · fully funded
							</span>
						</div>
						<div
							className="creator-modes"
							role="group"
							aria-label="Treasury action"
						>
							<button
								type="button"
								aria-pressed={creatorMode === "create"}
								disabled={busy || hasDraft}
								onClick={() => {
									setCreatorMode("create");
									setInput(initialInput);
								}}
							>
								New treasury
							</button>
							<button
								type="button"
								aria-pressed={creatorMode === "append"}
								disabled={!selected ||
									selected.data.authority !== sandbox?.creator.address ||
									selected.data.status === 2 || selected.data.lockedAt > 0n ||
									busy || hasDraft}
								onClick={beginAppend}
							>
								Add to {selected
									? decodeTemplateText(selected.data.name)
									: "live treasury"}
							</button>
						</div>
						{creatorMode === "append" && selected && (
							<section
								className="live-console"
								aria-label="Live treasury console"
							>
								<div>
									<span className="eyebrow">LIVE TREASURY</span>
									<strong>{decodeTemplateText(selected.data.name)}</strong>
									<code>{short(selected.address)}</code>
								</div>
								<dl>
									<div>
										<dt>Revision</dt>
										<dd>{selected.data.revision.toString()}</dd>
									</div>
									<div>
										<dt>Published bundles</dt>
										<dd>{selected.data.bundleCount}</dd>
									</div>
									<div>
										<dt>Unwon tickets</dt>
										<dd>{selected.data.remainingBundles.toString()}</dd>
									</div>
									<div>
										<dt>Pending opens</dt>
										<dd>{selected.data.pendingOpenings.toString()}</dd>
									</div>
								</dl>
							</section>
						)}
						<form
							className="creator-layout"
							onSubmit={(event) => {
								event.preventDefault();
								void run(async (session) => {
									if (exceedsBundleBudget) {
										throw new Error(
											`This treasury has room for ${bundleBudget} more bundle${
												bundleBudget === 1 ? "" : "s"
											}`,
										);
									}
									validateInput(input);
									if (creatorMode === "append") {
										if (!selected) {
											throw new Error(
												"Choose a live treasury before adding bundles",
											);
										}
										const template = await appendDrop(
											session,
											selected,
											input,
											progress,
										);
										selectedId.current = template.address;
										setNotice(
											`Treasury addition published as revision ${template.data.revision}. New boxes can use it immediately.`,
										);
									} else {
										const template = await createDrop(session, input, progress);
										selectedId.current = template.address;
										setNotice(
											"Treasury funded and published. Add prizes or lock its exact supply below.",
										);
									}
									setHasDraft(false);
									setPhase("received");
									setTab("receive");
								});
							}}
						>
							<div className="creator-form">
								{creatorMode === "create" && (
									<fieldset disabled={busy || hasDraft}>
										<legend>Drop identity</legend>
										<div className="form-pair">
											<label className="field">
												Template name<input
													aria-label="Template name"
													{...errorProps("name")}
													required
													value={input.name}
													maxLength={32}
													onChange={(event) =>
														setInput({ ...input, name: event.target.value })}
												/>
												{fieldError("name")}
											</label>
											<label className="field">
												Metadata URI <span>optional · permanent</span>
												<input
													type="url"
													aria-label="Metadata URI"
													{...errorProps("uri")}
													placeholder="https://your-project.com/drop.json"
													maxLength={200}
													value={input.uri}
													onChange={(event) =>
														setInput({ ...input, uri: event.target.value })}
												/>
												{fieldError("uri")}
											</label>
										</div>
										<UnlockDatePicker
											disabled={busy || hasDraft}
											value={input.opensAt}
											error={fieldErrors.opensAt}
											onChange={(opensAt) =>
												setInput({ ...input, opensAt })}
										/>
										<div className="form-pair">
											<label className="field">
												Settlement bounty <span>optional · SOL per reveal</span>
												<input
													aria-label="Settlement bounty"
													inputMode="decimal"
													{...errorProps("settlementBountySol")}
													value={input.settlementBountySol}
													onChange={(event) =>
														setInput({
															...input,
															settlementBountySol: event.target.value,
														})}
												/>
												{fieldError("settlementBountySol")}
											</label>
											<label className="field service-option">
												<span>Immutable result receipts</span>
												<input
													type="checkbox"
													checked={input.resultReceiptsEnabled}
													onChange={(event) =>
														setInput({
															...input,
															resultReceiptsEnabled: event.target.checked,
														})}
												/>
												<small>
													Creator prepays rent at lock. Leave off when your
													project does not need permanent CPI-verifiable
													results.
												</small>
											</label>
										</div>
									</fieldset>
								)}
								<fieldset disabled={busy || hasDraft}>
									<legend>
										{creatorMode === "append"
											? "New prize bundles"
											: "Prize bundles"}
									</legend>
									{fieldError("bundles")}
									<p className="field-help">
										One winning ticket delivers every asset in its bundle.
										Copies are the odds: eight identical copies means eight
										chances. No hidden weights.
									</p>
									<div className="bundle-editor">
										{input.rows.map((row, index) => (
											<section
												className="bundle-row"
												key={`${row.label}-${index}`}
												aria-label={`Bundle ${index + 1}`}
											>
												<div className="bundle-row__top">
													<span className="bundle-number">
														{String(index + 1).padStart(2, "0")}
													</span>
													<label className="field bundle-title">
														Bundle label<input
															aria-label={`Bundle ${index + 1} label`}
															{...errorProps(`row-${index}-label`)}
															value={row.label}
															onChange={(event) =>
																updateRow(index, { label: event.target.value })}
														/>
														{fieldError(`row-${index}-label`)}
													</label>
													<label className="field bundle-copies">
														Copies<input
															aria-label="Copies"
															{...errorProps(`row-${index}-quantity`)}
															type="number"
															min="1"
															max="1000000"
															required
															disabled={row.assets.some((asset) =>
																asset.kind === "nft"
															)}
															value={row.quantity}
															onChange={(event) =>
																updateRow(index, {
																	quantity: event.target.value,
																})}
														/>
														{fieldError(`row-${index}-quantity`)}
													</label>
													<div className="bundle-odds">
														<small>INITIAL ODDS</small>
														<strong>{preview?.odds[index] ?? "—"}</strong>
													</div>
													<button
														type="button"
														className="icon-button"
														aria-label={`Remove bundle ${index + 1}`}
														disabled={input.rows.length === 1}
														onClick={() =>
															setInput({
																...input,
																rows: input.rows.filter((_, position) =>
																	index !== position
																),
															})}
													>
														<Trash2 size={16} />
													</button>
												</div>
												{fieldError(`row-${index}-assets`)}
												<div className="bundle-assets">
													{row.assets.map((asset, assetIndex) => (
														<div className="asset-line" key={asset.id}>
															<div className="asset-mark">
																{asset.icon
																	? <img src={asset.icon} alt="" />
																	: asset.kind === "nft"
																	? <Gift size={18} />
																	: asset.kind === "token"
																	? <Tag size={18} />
																	: <span>◎</span>}
															</div>
															<div className="asset-identity">
																<strong>{asset.label}</strong>
																<span>
																	{asset.standard ?? (asset.kind === "sol"
																		? "Native SOL"
																		: `${asset.decimals} decimals`)} ·{" "}
																	<i>{asset.source}</i>
																</span>
																{asset.mint && (
																	<code title={asset.mint}>
																		{short(asset.mint)}
																	</code>
																)}
															</div>
															{asset.kind !== "nft" && (
																<label className="field asset-amount">
																	Amount per win<input
																		aria-label={`${asset.label} amount per win`}
																		inputMode="decimal"
																		{...errorProps(
																			`row-${index}-asset-${assetIndex}-amount`,
																		)}
																		value={asset.amount}
																		onChange={(event) =>
																			updateAsset(index, assetIndex, {
																				amount: event.target.value,
																			})}
																	/>
																	{fieldError(
																		`row-${index}-asset-${assetIndex}-amount`,
																	)}
																</label>
															)}
															{fieldError(
																`row-${index}-asset-${assetIndex}-mint`,
															)}
															<button
																type="button"
																className="icon-button"
																aria-label={`Remove ${asset.label}`}
																disabled={row.assets.length === 1}
																onClick={() =>
																	updateRow(index, {
																		assets: row.assets.filter((_, position) =>
																			position !== assetIndex
																		),
																	})}
															>
																<Trash2 size={15} />
															</button>
														</div>
													))}
												</div>
												<button
													type="button"
													className="add-asset-button"
													disabled={row.assets.length >= 4}
													onClick={() => setPickerFor(index)}
												>
													<Plus size={16} />Add asset to bundle{" "}
													<span>{row.assets.length}/4</span>
												</button>
											</section>
										))}
									</div>
									<button
										type="button"
										className="quiet-button"
										disabled={input.rows.length >= bundleBudget}
										onClick={() =>
											setInput({
												...input,
												rows: [...input.rows, makeBundle()],
											})}
									>
										<Plus size={17} />Add another bundle
									</button>
								</fieldset>
							</div>
							<aside className="creation-summary">
								<span className="eyebrow">FUNDING MANIFEST</span>
								<h2>
									{creatorMode === "append"
										? "Publish an addition."
										: "Back every promise."}
								</h2>
								<LootboxMachine phase={busy ? "commit" : "idle"} />
								<p>
									Assets are escrowed before their tickets become eligible. A
									half-funded bundle never enters the draw.
								</p>
								<dl className="facts">
									<div>
										<dt>New bundles</dt>
										<dd>{input.rows.length} / {bundleBudget}</dd>
									</div>
									<div>
										<dt>Capacity added</dt>
										<dd>{preview?.copies.toString() ?? "—"} boxes</dd>
									</div>
									<div>
										<dt>SOL to escrow</dt>
										<dd>{preview ? formatUnits(preview.sol) : "—"} SOL</dd>
									</div>
									<div>
										<dt>Other assets</dt>
										<dd>
											{preview
												? `${preview.tokenAssets} token lines · ${preview.nfts} NFTs`
												: "—"}
										</dd>
									</div>
									<div>
										<dt>Chance model</dt>
										<dd>Uniform per copy</dd>
									</div>
									<div>
										<dt>Change payer</dt>
										<dd>Creator wallet</dd>
									</div>
									<div>
										<dt>Open payer</dt>
										<dd>Box owner</dd>
									</div>
									<div>
										<dt>Permanent results</dt>
										<dd>
											{input.resultReceiptsEnabled
												? "Creator prepays at lock"
												: "Off · no extra rent"}
										</dd>
									</div>
									<div>
										<dt>Settlement bounty</dt>
										<dd>{input.settlementBountySol || "0"} SOL / box</dd>
									</div>
									<div>
										<dt>Network fees</dt>
										<dd>Shown per signing step</dd>
									</div>
								</dl>
								<p className="field-help">
									Jupiter and DAS choices are mirrored locally. Production
									integrations fund the selected token, Token-2022 mint,
									standard Metadata NFT, plain Core asset, or cNFT through typed
									SDK adapters.
								</p>
								{hasDraft && (
									<div className="draft-actions">
										<p className="draft-note">
											An unfinished funding manifest is locked to its saved
											assets. Resume it, or reclaim only its unpublished tail
											bundle. Already published bundles stay immutable.
										</p>
										<button
											type="button"
											className="quiet-button quiet-button--danger"
											disabled={!sandbox || busy}
											onClick={() =>
												void run(async (session) => {
													const result = await cancelSavedDraft(
														session,
														progress,
													);
													if (result.template) {
														selectedId.current = result.template.address;
													}
													setNotice(result.message);
													if (!result.draftRetained) {
														setInput(initialInput);
														setCreatorMode("create");
													}
												})}
										>
											<Trash2 size={15} />Reclaim staged draft
										</button>
									</div>
								)}
								<button
									type="submit"
									aria-describedby={exceedsBundleBudget
										? "bundle-budget-error"
										: !preview
										? "creator-validation-summary"
										: undefined}
									className="primary-button"
									disabled={!sandbox || busy || !preview ||
										exceedsBundleBudget ||
										(creatorMode === "append" && !selected)}
								>
									{busy
										? "Funding the manifest…"
										: hasDraft
										? "Resume funding"
										: creatorMode === "append"
										? "Fund & publish addition"
										: "Fund & publish treasury"}
									<ArrowRight size={18} />
								</button>
								{exceedsBundleBudget && (
									<p
										id="bundle-budget-error"
										className="field-error"
										role="alert"
									>
										This treasury has room for {bundleBudget} more bundle
										{bundleBudget === 1 ? "" : "s"}. Remove bundles from this
										manifest or create a new treasury.
									</p>
								)}
								{!preview && (
									<p
										id="creator-validation-summary"
										className="field-error"
										role="status"
									>
										Funding is unavailable. Fix the highlighted bundle or
										identity fields.
									</p>
								)}
								<p className="field-help">
									Several creator-signed transactions may be required. Confirmed
									steps are detected on-chain and skipped safely after a
									refresh.
								</p>
								<button
									type="button"
									className="quiet-button"
									disabled={!sandbox || busy}
									onClick={() =>
										void run(async (session) => {
											await session.faucet("creator");
											setNotice(
												"Creator reset to 100 test SOL. Resume funding when ready.",
											);
										})}
								>
									Reset creator test SOL
								</button>
							</aside>
						</form>
					</>
				)}

				{tab === "guide" && (
					<article className="guide">
						<h1>Surprise, with a paper trail.</h1>
						<p className="guide-lead">
							Lootbox turns a shared treasury into transferable gifts. The
							suspense is what you win—not whether the finite pool contains the
							promised prizes.
						</p>
						<h2>Bundles are the tickets.</h2>
						<p>
							A creator stages a complete bundle of one to four assets, funds
							every copy, and activates it. One bundle copy is one
							equal-probability ticket. SOL, classic SPL, safe Token-2022
							tokens, standard Token Metadata NFTs, plain Core assets, and
							compressed NFTs each have a typed transfer path.
						</p>
						<h2>The treasury only grows.</h2>
						<p>
							Before locking, live treasuries accept append-only additions.
							Funding drafts are invisible to draws and can be reclaimed or
							resumed. Activation increments the treasury revision, bundle
							count, inventory, and mint capacity together. Existing terms and
							bundle IDs never change.
						</p>
						<h2>Locking creates the tradable series.</h2>
						<p>
							The creator chooses a future reveal date, finishes every bundle,
							and locks once. In the same transaction, every missing box is
							minted so total supply exactly equals funded bundle copies. Mint
							authority is revoked and treasury additions stop forever. Each
							Token-2022 box has zero decimals, so wallets and markets can only
							move whole boxes.
						</p>
						<h2>Time creates a pre-reveal market.</h2>
						<p>
							Locked boxes can transfer and trade before reveal, while none can
							be opened early. Buyers can compare the visible remaining
							inventory, their own bundle valuations, and market price. Once
							prizes begin to leave the treasury, both the displayed odds and
							expected value update.
						</p>
						<h2>Every opening gets a snapshot.</h2>
						<p>
							After the reveal date, burning a box records the locked revision
							and eligible bundle prefix before randomness is requested.
							Allocation is FIFO and without replacement, so each win updates
							the odds for every unopened box while pending receipts retain
							their snapshot.
						</p>
						<h2>Payers are explicit.</h2>
						<p>
							The creator pays for treasury creation, funding, additions, exact
							issuance, and locking. The box owner pays to burn and request
							randomness. Verification and allocation are permissionless cranks,
							while claims always deliver to the recipient recorded at burn
							time.
						</p>
						<h2>Catalog results are not endorsements.</h2>
						<p>
							Jupiter Tokens supplies searchable token metadata and verification
							signals. Metaplex DAS supplies wallet-owned standard, Core, and
							compressed assets. Always inspect the exact mint, token program,
							transfer restrictions, plugins, and proof freshness. This local
							playground mirrors selections as disposable assets rather than
							moving mainnet property.
						</p>
						<h2>This is a local test network.</h2>
						<p>
							Surfpool executes the real Lootbox and token programs. The oracle
							emulator does not provide production-grade randomness or verify
							real enclave signatures. Test wallets live only in this browser
							origin. Never import real keys or send real funds.
						</p>
						<h2>Production gates remain visible.</h2>
						<p>
							A production deployment still needs a real oracle service, crank
							operating policy and reserve, incident recovery procedures,
							external program compatibility fixtures, an independent audit,
							jurisdiction-specific review, and real wallet transaction
							simulation. These are deployment controls—not missing treasury
							semantics.
						</p>
						<p>
							<a
								href="https://github.com/pina-rs/lootbox/blob/feat/treasury-templates/docs/treasury-templates.md"
								target="_blank"
								rel="noreferrer"
							>
								Read the protocol specification <ArrowRight size={16} />
							</a>
						</p>
					</article>
				)}

				{pickerFor !== null && sandbox && (
					<AssetPicker
						owner={sandbox.creator.address}
						onClose={() => setPickerFor(null)}
						onPick={(asset) => {
							const row = input.rows[pickerFor];
							if (!row || row.assets.length >= 4) return;
							updateRow(pickerFor, {
								assets: [...row.assets, asset],
								...(asset.kind === "nft" ? { quantity: "1" } : {}),
							});
						}}
					/>
				)}
				{transactions.length > 0 && (
					<details className="transaction-log">
						<summary>
							Transaction trail · {transactions.length} recent receipts
						</summary>
						<ol>
							{transactions.map((item) => (
								<li key={item.signature}>
									<Check size={14} />
									<strong>{item.label}</strong>
									<code>{item.signature}</code>
								</li>
							))}
						</ol>
					</details>
				)}
			</main>
			<footer className="workshop-footer">
				<span>
					<Box size={16} />Small primitive. Big possibilities.
				</span>
				<span>LOCAL TEST ASSETS / NEVER REAL FUNDS</span>
			</footer>
		</div>
	);
}
