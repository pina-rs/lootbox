import {
	bundleAssets,
	type ChainBundle,
	type ChainOpening,
	type ChainTemplate,
	decodeTemplateText,
	templateInventory,
	templateMintCapacity,
} from "@pina-rs/lootbox";
import { type Address, address } from "@solana/kit";
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
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LootboxMachine, type MachinePhase } from "./lootbox/Machine.js";
import {
	connectPlayground,
	createDrop,
	creatorErrors,
	type CreatorInput,
	formatUnits,
	initialInput,
	parseUnits,
	type Playground,
	previewInput,
	type PrizeRow,
	savedInput,
	settleOpenings,
	validateInput,
} from "./lootbox/playground.js";

type Workspace = {
	templates: ChainTemplate[];
	openings: ChainOpening[];
	bundles: ChainBundle[];
	selected: ChainTemplate | null;
	boxes: bigint;
	supply: bigint;
	balance: bigint;
	chainTime: bigint;
};
const empty: Workspace = {
	templates: [],
	openings: [],
	bundles: [],
	selected: null,
	boxes: 0n,
	supply: 0n,
	balance: 0n,
	chainTime: 0n,
};
const short = (value: string) => `${value.slice(0, 5)}…${value.slice(-5)}`;
const errorMessage = (error: unknown) =>
	error instanceof Error
		? error.message
		: "Something went wrong. Refresh chain state and retry.";

function prizeName(bundle: ChainBundle) {
	const assets = bundleAssets(bundle.data);
	const nfts = assets.filter((asset) => asset.kind === "nft").length;
	return [
		...assets.filter((asset) => asset.kind !== "nft").map((asset) =>
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
	const [hasDraft, setHasDraft] = useState(false);
	const [busy, setBusy] = useState(false);
	const [connecting, setConnecting] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [phase, setPhase] = useState<MachinePhase>("received");
	const [revealed, setRevealed] = useState<Set<string>>(new Set());
	const [giftAmount, setGiftAmount] = useState("1");
	const [destination, setDestination] = useState("");
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
				) ?? templates[0] ?? null;
			const [bundles, boxes, supply, balance, slot] = await Promise.all([
				selected ? client.bundles(selected) : [],
				selected
					? client.boxBalance(session.recipient.address, selected.data.boxMint)
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
				supply,
				balance: balance.value,
				chainTime: chainTime ?? 0n,
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
			const draft = savedInput(session);
			if (draft) {
				setInput(draft);
				setHasDraft(true);
				setTab("create");
			}
			await refresh(session);
		} catch (error) {
			setError(errorMessage(error));
		} finally {
			setConnecting(false);
		}
	}, [refresh]);
	useEffect(() => {
		void connect();
	}, [connect]);
	useEffect(() => {
		if (!sandbox || busy) return;
		const timer = setInterval(() => {
			void refresh(sandbox).catch((error: unknown) =>
				setError(errorMessage(error))
			);
		}, 5000);
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
		} catch (error) {
			setError(errorMessage(error));
		} finally {
			try {
				await refresh(sandbox);
			} catch (error) {
				setError(errorMessage(error));
			}
			try {
				setHasDraft(savedInput(sandbox) !== null);
			} catch (error) {
				setError(errorMessage(error));
			}
			setBusy(false);
			pendingAction.current = false;
		}
	};
	const selected = workspace.selected;
	const preview = previewInput(input);
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
		item.data.recipient === sandbox?.recipient.address
	)
		.sort((a, b) => a.data.sequence > b.data.sequence ? -1 : 1);
	const receipt = receipts.find((item) => item.data.status < 3) ?? receipts[0];
	const delivered = receipt?.data.status === 3;
	const visiblePrize = receipt && receipt.data.status >= 2 &&
		(revealed.has(receipt.address) || delivered);
	const prize = visiblePrize
		? workspace.bundles[receipt.data.selectedOutcome]
		: undefined;
	const capacity = selected
		? templateMintCapacity(selected.data, workspace.supply)
		: 0n;
	const inventory = selected ? templateInventory(selected.data) : [];
	const locked = selected && selected.data.opensAt > workspace.chainTime;
	const mintStopped = selected &&
		inventory.some((item) => item.remaining === 0n);
	const effectivePhase: MachinePhase = busy
		? phase
		: visiblePrize
		? delivered ? "redeemed" : "revealed"
		: phase === "received"
		? "received"
		: "idle";
	const updateRow = (index: number, patch: Partial<PrizeRow>) =>
		setInput((value) => ({
			...value,
			rows: value.rows.map((row, position) =>
				index === position ? { ...row, ...patch } : row
			),
		}));
	const copy = (value: string) => {
		void navigator.clipboard.writeText(value).then(
			() => setNotice("Address copied"),
			() =>
				setError("Clipboard unavailable. Select and copy the address below."),
		);
	};

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
				Real local transactions. Test assets only. Randomness is emulated.{" "}
				<a
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
											? "Your prize is in your test wallet. The receipt stays on-chain."
											: "The result is recorded. Claim it whenever you’re ready."
										: "A sealed gift. A real treasury. One moment of discovery."}
								</p>
							</div>
							<button className="quiet-button" onClick={() => setTab("create")}>
								<Plus size={17} />Create a drop
							</button>
						</div>
						<section className="opening-workbench" aria-label="Gift workspace">
							<aside className="drop-drawer">
								<h2>Your opening table</h2>
								<label className="field">
									Template<div className="select-wrap">
										<select
											aria-label="Choose template"
											value={selected?.address ?? ""}
											disabled={!sandbox || busy || !workspace.templates.length}
											onChange={(event) => {
												if (sandbox) {
													setPhase("received");
													void run(async (session) => {
														await refresh(session, address(event.target.value));
													});
												}
											}}
										>
											<option value="" disabled>No templates yet</option>
											{workspace.templates.map((item) => (
												<option key={item.address} value={item.address}>
													{decodeTemplateText(item.data.name)}
													{!item.data.sealed ? " · draft" : ""}
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
										<dt>Claim opens</dt>
										<dd>
											{selected?.data.opensAt
												? new Date(Number(selected.data.opensAt) * 1000)
													.toLocaleString()
												: "Immediately"}
										</dd>
									</div>
									<div>
										<dt>Backing</dt>
										<dd>Fully funded inventory</dd>
									</div>
									<div>
										<dt>Transferable</dt>
										<dd>Token-2022</dd>
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
												<p>Your box is burned. Its receipt is safe on-chain.</p>
												<button
													className="primary-button"
													disabled={busy}
													onClick={() =>
														void run(async (session) => {
															await settleOpenings(session, selected, progress);
															setNotice("Prize recorded. Click to reveal it.");
														})}
												>
													{busy ? "Recording your prize…" : "Resume opening"}
													<ArrowRight size={18} />
												</button>
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
														Boolean(locked) || !selected.data.sealed}
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
														: locked
														? "Waiting for the unlock date"
														: delivered && workspace.boxes > 0n
														? "Open another gift"
														: workspace.boxes === 0n
														? "No sealed gifts yet"
														: "Open a gift"}
													<ArrowRight size={18} />
												</button>
												<p>
													{locked
														? "You can still transfer this gift before it unlocks."
														: "Opening burns one token. Reveal and claim are separate steps."}
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
							</div>
							<aside className="prize-manifest">
								<h2>What’s in the treasury?</h2>
								<p>Live odds. Complete prize bundles.</p>
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
															<span>{item?.remaining.toString()} left</span>
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
															<summary>Inspect assets</summary>
															{bundleAssets(bundle.data).filter((asset) =>
																asset.kind !== "sol"
															).map((asset) => (
																<code key={asset.index}>
																	{asset.kind.toUpperCase()} {asset.mint}
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
											<p>No prizes packed yet.</p>
											<span>
												The workshop turns one treasury into a whole drop.
											</span>
										</div>
									)}
								<p className="manifest-note">
									Each win removes one bundle. Odds change as the treasury
									empties. Already minted boxes stay redeemable.
								</p>
							</aside>
						</section>
						{selected && (
							<section className="dispatch">
								<div>
									<h2>Send a little suspense.</h2>
									<p>
										{mintStopped
											? "A prize tier is depleted. New minting has stopped; existing gifts still open."
											: `${capacity} more boxes can be minted from this treasury.`}
									</p>
								</div>
								<div className="dispatch-fields">
									<label className="field">
										Recipient address<input
											value={destination}
											onChange={(event) => setDestination(event.target.value)}
											disabled={busy}
											spellCheck={false}
										/>
									</label>
									<label className="field field--amount">
										Boxes<input
											type="number"
											min="1"
											step="1"
											value={giftAmount}
											onChange={(event) => setGiftAmount(event.target.value)}
											disabled={busy}
										/>
									</label>
									<button
										className="primary-button"
										disabled={busy || capacity === 0n ||
											selected.data.authority !== sandbox?.creator.address}
										onClick={() =>
											void run(async (session) => {
												await session.client("creator", progress).mint(
													selected,
													address(destination),
													parseUnits(giftAmount, 0),
												);
												setPhase("received");
												setNotice(
													`${giftAmount} sealed gift${
														giftAmount === "1" ? "" : "s"
													} minted to ${short(destination)}`,
												);
											})}
									>
										<Gift size={18} />Mint a gift
									</button>
								</div>
								<details>
									<summary>Transfer gifts you already hold</summary>
									<p>
										Standard Token-2022 transfer from the recipient test wallet.
										This does not mint new boxes or change the treasury.
									</p>
									<button
										className="quiet-button"
										disabled={busy || workspace.boxes === 0n}
										onClick={() =>
											void run(async (session) => {
												await session.client("recipient", progress).transfer(
													selected,
													address(destination),
													parseUnits(giftAmount, 0),
												);
												setNotice("Sealed gifts transferred");
											})}
									>
										Transfer to address above <ArrowRight size={15} />
									</button>
								</details>
							</section>
						)}
					</>
				)}

				{tab === "create" && (
					<>
						<div className="workspace-title">
							<div>
								<h1>Pack the possibilities.</h1>
								<p>
									One template. One funded treasury. A whole lot of surprises.
								</p>
							</div>
							<span className="mode-label">
								<ShieldCheck size={16} />Fully funded · finite inventory
							</span>
						</div>
						<form
							className="creator-layout"
							onSubmit={(event) => {
								event.preventDefault();
								void run(async (session) => {
									validateInput(input);
									const template = await createDrop(session, input, progress);
									selectedId.current = template.address;
									setHasDraft(false);
									setPhase("received");
									setTab("receive");
									setNotice(
										"Treasury funded and sealed. Mint your first gift below.",
									);
								});
							}}
						>
							<div className="creator-form">
								<fieldset disabled={busy || hasDraft}>
									<legend>Your drop</legend>
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
											Earliest claim date{" "}
											<span>optional · your local time</span>
											<input
												type="datetime-local"
												aria-label="Earliest claim date"
												{...errorProps("opensAt")}
												value={input.opensAt}
												onChange={(event) =>
													setInput({ ...input, opensAt: event.target.value })}
											/>
											{fieldError("opensAt")}
										</label>
									</div>
									<label className="field">
										Metadata URI <span>optional · immutable after sealing</span>
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
								</fieldset>
								<fieldset disabled={busy || hasDraft}>
									<legend>Prize bundles</legend>
									{fieldError("bundles")}
									<p className="field-help">
										A draw wins one complete row. Quantity sets inventory;
										weight sets the chance of each remaining copy.
									</p>
									<div className="bundle-editor">
										{input.rows.map((row, index) => (
											<div className="bundle-row" key={index}>
												<div className="bundle-row__top">
													<strong>
														Bundle {index + 1}{" "}
														<span className="bundle-preview">
															{preview?.odds[index] ?? "—"} initial chance
														</span>
													</strong>
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
												<div className="bundle-fields">
													<label className="field">
														Prize<select
															value={row.kind}
															onChange={(event) => {
																const kind = event.target
																	.value as PrizeRow["kind"];
																updateRow(index, {
																	kind,
																	amount: kind === "token" ? "100" : "0.1",
																	...(kind === "nft" ? { quantity: "1" } : {}),
																});
															}}
														>
															<option value="sol">SOL</option>
															<option value="token">Test tokens</option>
															<option value="nft">NFT bundle + SOL</option>
														</select>
													</label>
													<label className="field">
														{row.kind === "nft"
															? "Bonus SOL"
															: row.kind === "token"
															? "Tokens / win"
															: "SOL / win"}
														<input
															required
															inputMode="decimal"
															aria-label={row.kind === "nft"
																? "Bonus SOL"
																: row.kind === "token"
																? "Tokens / win"
																: "SOL / win"}
															{...errorProps(`row-${index}-amount`)}
															value={row.amount}
															onChange={(event) =>
																updateRow(index, {
																	amount: event.target.value,
																})}
														/>
														{fieldError(`row-${index}-amount`)}
													</label>
													<label className="field">
														Copies<input
															aria-label="Copies"
															{...errorProps(`row-${index}-quantity`)}
															type="number"
															min="1"
															max="1000"
															required
															disabled={row.kind === "nft"}
															value={row.quantity}
															onChange={(event) =>
																updateRow(index, {
																	quantity: event.target.value,
																})}
														/>
														{fieldError(`row-${index}-quantity`)}
													</label>
													<label className="field">
														Weight<input
															aria-label="Weight"
															{...errorProps(`row-${index}-weight`)}
															type="number"
															min="1"
															max="1000"
															required
															value={row.weight}
															onChange={(event) =>
																updateRow(index, {
																	weight: event.target.value,
																})}
														/>
														{fieldError(`row-${index}-weight`)}
													</label>
													{row.kind === "nft" && (
														<label className="field">
															Unique NFTs<select
																value={row.nftCount}
																onChange={(event) =>
																	updateRow(index, {
																		nftCount: event.target.value,
																	})}
															>
																<option>1</option>
																<option>2</option>
																<option>3</option>
															</select>
														</label>
													)}
												</div>
											</div>
										))}
									</div>
									<button
										type="button"
										className="quiet-button"
										disabled={input.rows.length >= 8}
										onClick={() =>
											setInput({
												...input,
												rows: [...input.rows, {
													kind: "sol",
													amount: "0.5",
													quantity: "1",
													weight: "1",
													nftCount: "1",
												}],
											})}
									>
										<Plus size={17} />Add prize bundle
									</button>
								</fieldset>
							</div>
							<aside className="creation-summary">
								<h2>Seal it with substance.</h2>
								<LootboxMachine phase={busy ? "commit" : "idle"} />
								<p>
									Every listed prize is deposited before this template can mint
									a single gift.
								</p>
								<dl className="facts">
									<div>
										<dt>Prize tiers</dt>
										<dd>{input.rows.length} / 8</dd>
									</div>
									<div>
										<dt>SOL to escrow</dt>
										<dd>{preview ? formatUnits(preview.sol) : "—"} SOL</dd>
									</div>
									<div>
										<dt>Test prizes</dt>
										<dd>
											{preview?.tokens.toString() ?? "—"} tokens /{" "}
											{preview?.nfts ?? "—"} NFTs
										</dd>
									</div>
									<div>
										<dt>Maximum boxes</dt>
										<dd>{preview?.copies.toString() ?? "—"}</dd>
									</div>
									<div>
										<dt>Box standard</dt>
										<dd>Token-2022</dd>
									</div>
									<div>
										<dt>Metadata</dt>
										<dd>Immutable</dd>
									</div>
									<div>
										<dt>Test wallet</dt>
										<dd>
											{sandbox
												? short(sandbox.creator.address)
												: "Not connected"}
										</dd>
									</div>
								</dl>
								<p className="field-help">
									The sandbox creates fresh, fixed-supply test tokens and basic
									one-of-one NFTs for you. They have no real-world value.
								</p>
								{hasDraft && (
									<p className="draft-note">
										An unfinished draft is saved. Resume it to continue from the
										last funded asset.
									</p>
								)}
								<button
									type="submit"
									aria-describedby={!preview
										? "creator-validation-summary"
										: undefined}
									className="primary-button"
									disabled={!sandbox || busy || !preview}
								>
									{busy
										? "Packing your treasury…"
										: hasDraft
										? "Resume funding & seal"
										: "Fund treasury & seal"}
									<ArrowRight size={18} />
								</button>
								{!preview && (
									<p
										id="creator-validation-summary"
										className="field-error"
										role="status"
									>
										Funding is unavailable. Fix the highlighted prize or
										template fields above.
									</p>
								)}
								<p className="field-help">
									Uses creator test SOL for prizes and rent. Several signed
									transactions; safe to resume after a refresh.
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
							Lootbox turns a shared treasury into tradable gifts. The suspense
							is in what you win—not whether the finite pool contains the
							promised prizes.
						</p>
						<h2>A template is the minter.</h2>
						<p>
							Choose complete bundles: SOL, tokens, or multiple specific NFTs.
							Deposit every copy, then seal the template. Its name, URI, unlock
							date, and prize table cannot be edited after sealing. Each
							unopened box is one unit of a transferable Token-2022 mint.
						</p>
						<h2>Odds follow the inventory.</h2>
						<p>
							A bundle’s chance is its remaining copies × its weight, divided by
							that total across the pool. Winners remove complete bundles
							without replacement. When a prize tier sells out, minting stops.
							Existing holders can still draw from the remaining inventory.
						</p>
						<h2>Opening is a commitment.</h2>
						<p>
							Burning a box and committing fresh randomness happen together.
							Proofs are verified and openings allocated in request order, so a
							fast caller cannot jump the queue. Clicking reveal only unveils an
							already-recorded result. Claims deliver every asset to the
							recorded recipient; failed deliveries resume without drawing
							again.
						</p>
						<h2>Probabilistic backing stays in scope.</h2>
						<p>
							The current on-chain mode is fully funded finite inventory. A
							separate probabilistically backed mode will allow reserves below
							worst-case aggregate payouts, with an explicit risk budget and a
							defined shortfall contract. It is not enabled by these controls. A
							reserve buffer is not a payout guarantee, and a unique NFT cannot
							be promised twice.
						</p>
						<h2>This is a local test network.</h2>
						<p>
							Surfpool executes the real Lootbox and token programs. The oracle
							is a test emulator: it does not provide production-grade
							randomness or verify real enclave signatures. Both test wallets
							are generated in your browser and stored on this origin. Never
							import real keys or send real funds. Restarting the local service
							clears the chain and creates a new wallet namespace.
						</p>
						<h2>Before real value is at stake.</h2>
						<p>
							Production oracle integration, recovery from oracle outages or
							expired commitments, independent security review, and production
							wallet connections remain release gates. A stalled first-in-line
							commitment can currently block subsequent openings. This
							playground must not be exposed as a public funded service.
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
