import {
	Check,
	CheckCircle2,
	Coins,
	Image,
	Layers3,
	LockKeyhole,
	Pencil,
	Search,
	ShieldAlert,
	Sparkles,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	type AssetSearchResponse,
	type DraftAsset,
	loadPrizePoolItem,
	LOCAL_PRIZE_POOL_MAX,
	makeAsset,
	type NftSearchResult,
	prizePoolEligible,
	searchNfts,
	searchTokens,
	type TokenSearchResult,
} from "./playground.js";

type Tab = "tokens" | "nfts" | "pools" | "manual";
type Props = Readonly<{
	owner: string;
	onClose: () => void;
	onPick: (asset: DraftAsset) => void;
}>;

const emptyTokens: AssetSearchResponse<TokenSearchResult> = {
	items: [],
	source: "unavailable",
};
const emptyNfts: AssetSearchResponse<NftSearchResult> = {
	items: [],
	source: "unavailable",
};

function identifier() {
	return crypto.randomUUID?.() ?? String(Date.now());
}

export function AssetPicker({ owner, onClose, onPick }: Props) {
	const dialog = useRef<HTMLElement>(null);
	const close = useRef(onClose);
	close.current = onClose;
	const [tab, setTab] = useState<Tab>("tokens");
	const [query, setQuery] = useState("BONK");
	const [tokens, setTokens] = useState(emptyTokens);
	const [nfts, setNfts] = useState(emptyNfts);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [manualKind, setManualKind] = useState<"token" | "nft">("token");
	const [manualMint, setManualMint] = useState("");
	const [manualLabel, setManualLabel] = useState("");
	const [manualDecimals, setManualDecimals] = useState("0");
	const [poolSelection, setPoolSelection] = useState<
		readonly NftSearchResult[]
	>(
		[],
	);
	const [resolvingPool, setResolvingPool] = useState(false);
	const poolRequest = useRef(0);
	const searchRequest = useRef(0);
	const mounted = useRef(true);

	const dismiss = () => {
		poolRequest.current += 1;
		onClose();
	};

	useEffect(() => {
		mounted.current = true;
		const previous = document.activeElement instanceof HTMLElement
			? document.activeElement
			: null;
		const focusable = () =>
			Array.from(
				dialog.current?.querySelectorAll<HTMLElement>(
					'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
				) ?? [],
			);
		focusable()[0]?.focus();
		const keydown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				poolRequest.current += 1;
				close.current();
			}
			if (event.key !== "Tab") return;
			const items = focusable();
			const first = items[0];
			const last = items.at(-1);
			if (!first || !last) return;
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", keydown);
		return () => {
			mounted.current = false;
			poolRequest.current += 1;
			document.removeEventListener("keydown", keydown);
			previous?.focus();
		};
	}, []);

	useEffect(() => {
		poolRequest.current += 1;
		setResolvingPool(false);
		setPoolSelection((current) =>
			current.filter((item) => prizePoolEligible(item, owner))
		);
	}, [owner]);

	useEffect(() => {
		const requestId = ++searchRequest.current;
		if (tab === "manual") {
			setLoading(false);
			return;
		}
		const timer = setTimeout(() => {
			setLoading(true);
			setError("");
			const request = tab === "tokens"
				? searchTokens(query).then((result) => {
					if (mounted.current && searchRequest.current === requestId) {
						setTokens(result);
					}
				})
				: searchNfts(owner, query).then((result) => {
					if (mounted.current && searchRequest.current === requestId) {
						setNfts(result);
					}
				});
			void request.catch((reason: unknown) => {
				if (mounted.current && searchRequest.current === requestId) {
					setError(
						reason instanceof Error ? reason.message : "Asset search failed",
					);
				}
			}).finally(() => {
				if (mounted.current && searchRequest.current === requestId) {
					setLoading(false);
				}
			});
		}, 320);
		return () => clearTimeout(timer);
	}, [owner, query, tab]);

	const add = (asset: DraftAsset) => {
		onPick(asset);
		dismiss();
	};
	const source = tab === "tokens" ? tokens : nfts;
	const selectedTree = poolSelection[0]?.tree;
	const togglePoolItem = (item: NftSearchResult) => {
		poolRequest.current += 1;
		setResolvingPool(false);
		setPoolSelection((current) => {
			if (current.some(({ id }) => id === item.id)) {
				return current.filter(({ id }) => id !== item.id);
			}
			if (!prizePoolEligible(item, owner)) return current;
			const tree = current[0]?.tree;
			return (!tree || item.tree === tree) &&
					current.length < LOCAL_PRIZE_POOL_MAX
				? [...current, item]
				: current;
		});
	};
	const addPrizePool = async () => {
		if (!selectedTree || poolSelection.length === 0) return;
		const request = ++poolRequest.current;
		setResolvingPool(true);
		setError("");
		try {
			const items = await Promise.all(
				poolSelection.map((item) => loadPrizePoolItem(item, owner)),
			);
			if (!mounted.current || request !== poolRequest.current) return;
			onPick({
				id: identifier(),
				kind: "prizePool",
				label: `${items.length} NFT PrizePool`,
				amount: "1",
				source: "das",
				decimals: 0,
				mint: selectedTree,
				standard: "Entropy-selected compressed NFTs",
				poolItems: items,
				...(items[0]?.image ? { icon: items[0].image } : {}),
			});
			dismiss();
		} catch (reason: unknown) {
			if (!mounted.current || request !== poolRequest.current) return;
			setError(
				reason instanceof Error ? reason.message : "Proof validation failed",
			);
		} finally {
			if (mounted.current && request === poolRequest.current) {
				setResolvingPool(false);
			}
		}
	};

	return (
		<div
			className="asset-picker-backdrop"
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) dismiss();
			}}
		>
			<section
				ref={dialog}
				className={`asset-picker${
					tab === "pools" ? " asset-picker--pool" : ""
				}`}
				role="dialog"
				aria-modal="true"
				aria-labelledby="asset-picker-title"
			>
				<header>
					<div>
						<span className="eyebrow">TREASURY CATALOG</span>
						<h2 id="asset-picker-title">
							{tab === "pools" ? "Build a PrizePool" : "Add an asset"}
						</h2>
					</div>
					<button
						type="button"
						className="icon-button"
						aria-label="Close asset picker"
						onClick={dismiss}
					>
						<X size={19} />
					</button>
				</header>
				<nav aria-label="Asset source">
					{([
						["tokens", "Jupiter tokens", Coins],
						[
							"nfts",
							"Wallet NFTs",
							Image,
						],
						["pools", "Build PrizePool", Layers3],
						[
							"manual",
							"Manual",
							Pencil,
						],
					] as const).map((
						[value, label, Icon],
					) => (
						<button
							type="button"
							key={value}
							aria-current={tab === value ? "page" : undefined}
							onClick={() => {
								poolRequest.current += 1;
								setResolvingPool(false);
								setTab(value);
								setQuery(value === "tokens" ? "BONK" : "");
							}}
						>
							<Icon size={16} />
							{label}
						</button>
					))}
				</nav>

				{tab !== "manual"
					? (
						<div
							className={`asset-picker__browser${
								tab === "pools" ? " asset-picker__browser--pool" : ""
							}`}
						>
							<div className="asset-picker__catalog">
								{(tab === "nfts" || tab === "pools") && (
									<label className="field">
										Wallet address
										<input
											value={owner}
											spellCheck={false}
											readOnly
										/>
									</label>
								)}
								<label className="field search-field">
									<span className="sr-only">Search assets</span>
									<Search size={17} />
									<input
										aria-label="Search assets"
										placeholder={tab === "tokens"
											? "Search symbol, name, or mint"
											: tab === "pools"
											? "Filter immutable compressed NFTs"
											: "Filter wallet NFTs"}
										value={query}
										onChange={(event) => setQuery(event.target.value)}
									/>
								</label>
								<div
									className={`catalog-status catalog-status--${source.source}`}
									aria-live="polite"
								>
									{source.source === "live"
										? <Check size={14} />
										: <ShieldAlert size={14} />}
									{source.source === "live"
										? `${
											tab === "tokens" ? "Jupiter Tokens" : "Metaplex DAS"
										} · live data`
										: source.message ??
											(loading
												? "Connecting to catalog…"
												: "Catalog unavailable")}
								</div>
								{error && <p className="field-error" role="alert">{error}</p>}
								<div className="asset-results" aria-busy={loading}>
									{tab === "tokens"
										? tokens.items.map((token) => (
											<button
												type="button"
												key={token.id}
												onClick={() =>
													add({
														id: identifier(),
														kind: "token",
														label: token.symbol,
														amount: "1",
														source: "jupiter",
														decimals: token.decimals,
														mint: token.id,
														tokenProgram: token.tokenProgram,
														...(token.icon ? { icon: token.icon } : {}),
													})}
											>
												{token.icon
													? <img src={token.icon} alt="" />
													: <Coins size={22} />}
												<span>
													<strong>{token.symbol}</strong>
													<small>{token.name}</small>
												</span>
												<i>{token.verified ? "VERIFIED" : "UNVERIFIED"}</i>
											</button>
										))
										: nfts.items.map((nft) => {
											const eligible = prizePoolEligible(nft, owner);
											const selected = poolSelection.some(({ id }) =>
												id === nft.id
											);
											const otherTree = tab === "pools" && Boolean(
												selectedTree && nft.tree !== selectedTree,
											);
											const poolFull = tab === "pools" && !selected &&
												poolSelection.length >= LOCAL_PRIZE_POOL_MAX;
											return (
												<button
													type="button"
													key={nft.id}
													aria-pressed={tab === "pools" ? selected : undefined}
													disabled={tab === "pools" &&
														(!eligible || otherTree || poolFull)}
													onClick={() =>
														tab === "pools" ? togglePoolItem(nft) : add({
															id: identifier(),
															kind: "nft",
															label: nft.name,
															amount: "1",
															source: "das",
															decimals: 0,
															mint: nft.id,
															standard: nft.standard,
															...(nft.image ? { icon: nft.image } : {}),
														})}
												>
													{nft.image
														? <img src={nft.image} alt="" />
														: <Image size={22} />}
													<span>
														<strong>{nft.name}</strong>
														<small>{nft.standard}</small>
													</span>
													<i>
														{tab === "pools"
															? selected
																? "SELECTED"
																: eligible
																? "POOL READY"
																: nft.mutable
																? "MUTABLE"
																: nft.delegated
																? "DELEGATED"
																: "INELIGIBLE"
															: nft.compressed
															? "COMPRESSED"
															: "NFT"}
													</i>
												</button>
											);
										})}
									{!loading && source.items.length === 0 && (
										<div className="catalog-empty">
											<Sparkles size={24} />
											<p>No matching assets.</p>
											<span>Try a mint address or switch to Manual.</span>
										</div>
									)}
								</div>
							</div>
							{tab === "pools" && (
								<section
									className="pool-composer"
									aria-label="PrizePool selection"
								>
									<ol
										className="pool-transfer-steps"
										aria-label="PrizePool transfer plan"
									>
										<li data-complete={poolSelection.length > 0}>
											<strong>1</strong>
											<span>
												<b>Select</b>One immutable tree
											</span>
										</li>
										<li data-complete={false}>
											<strong>2</strong>
											<span>
												<b>Verify</b>Refresh every proof
											</span>
										</li>
										<li data-complete={false}>
											<strong>3</strong>
											<span>
												<b>Escrow</b>Transfer, then seal
											</span>
										</li>
									</ol>
									<div className="pool-composer__status">
										<Layers3 size={22} />
										<div>
											<strong>
												{poolSelection.length}{" "}
												item{poolSelection.length === 1 ? "" : "s"}
											</strong>
											<span>
												{poolSelection.length > 0
													? `${
														poolSelection.length * 2 + 2
													} resumable setup transactions`
													: `Choose up to ${LOCAL_PRIZE_POOL_MAX} items; one item becomes one ticket and one eventual winner.`}
											</span>
										</div>
										<code>
											{selectedTree
												? `${selectedTree.slice(0, 6)}…${
													selectedTree.slice(-6)
												}`
												: "Choose a tree"}
										</code>
									</div>
									{poolSelection.length > 0 && (
										<ul
											className="pool-selection"
											aria-label="Selected compressed NFTs"
										>
											{poolSelection.map((item, index) => (
												<li key={item.id}>
													<span className="pool-selection__number">
														{String(index + 1).padStart(2, "0")}
													</span>
													{item.image
														? <img src={item.image} alt="" />
														: <Image size={18} />}
													<span>
														<strong>{item.name}</strong>
														<small>Leaf {item.leafIndex}</small>
													</span>
													<button
														type="button"
														aria-label={`Remove ${item.name} from PrizePool`}
														onClick={() => togglePoolItem(item)}
													>
														<X size={14} />
													</button>
												</li>
											))}
										</ul>
									)}
									<div className="pool-assurances">
										<span>
											<LockKeyhole size={14} />PDA custody after deposit
										</span>
										<span>
											<CheckCircle2 size={14} />Exact asset identities pinned
										</span>
										<span>
											<Sparkles size={14} />Winner chosen from draw entropy
										</span>
									</div>
									<p>
										Only immutable, undelegated compressed NFTs from one
										Bubblegum tree can share a pool. Each transfer is signed
										separately and the proof is refreshed after every root
										change. Creator and collection verification badges can still
										change, but cannot change which asset a winner receives.
									</p>
									<button
										type="button"
										className="primary-button"
										disabled={poolSelection.length === 0 || resolvingPool}
										onClick={() => void addPrizePool()}
									>
										{resolvingPool
											? "Verifying every proof…"
											: `Add ${poolSelection.length || ""} NFT PrizePool`}
									</button>
								</section>
							)}
						</div>
					)
					: (
						<form
							className="manual-asset"
							onSubmit={(event) => {
								event.preventDefault();
								add({
									id: identifier(),
									kind: manualKind,
									label: manualLabel.trim() ||
										(manualKind === "token" ? "Custom token" : "Custom NFT"),
									amount: manualKind === "token" ? "1" : "1",
									source: "manual",
									decimals: manualKind === "token" ? Number(manualDecimals) : 0,
									mint: manualMint.trim(),
									...(manualKind === "nft" ? { standard: "Manual NFT" } : {}),
								});
							}}
						>
							<div className="form-pair">
								<label className="field">
									Asset type<select
										value={manualKind}
										onChange={(event) =>
											setManualKind(event.target.value as typeof manualKind)}
									>
										<option value="token">Fungible token</option>
										<option value="nft">NFT / collectible</option>
									</select>
								</label>
								<label className="field">
									Label<input
										required
										value={manualLabel}
										onChange={(event) => setManualLabel(event.target.value)}
										placeholder="e.g. BONK"
									/>
								</label>
							</div>
							<label className="field">
								Mint / asset address<input
									required
									spellCheck={false}
									value={manualMint}
									onChange={(event) => setManualMint(event.target.value)}
								/>
							</label>
							{manualKind === "token" && (
								<label className="field">
									Decimals<input
										required
										type="number"
										min="0"
										max="9"
										value={manualDecimals}
										onChange={(event) => setManualDecimals(event.target.value)}
									/>
								</label>
							)}
							<button className="primary-button" type="submit">
								Use this asset
							</button>
						</form>
					)}
				<footer>
					{tab !== "pools" && (
						<>
							<button
								type="button"
								className="quiet-button"
								onClick={() => add(makeAsset("sol"))}
							>
								Add native SOL
							</button>
							<button
								type="button"
								className="quiet-button"
								onClick={() => add(makeAsset(tab === "nfts" ? "nft" : "token"))}
							>
								Add a test {tab === "nfts" ? "NFT" : "token"}
							</button>
						</>
					)}
				</footer>
				<p className="picker-disclosure">
					The local playground mirrors catalog selections as valueless Surfpool
					assets. Production funding transfers the exact selected leaves into
					the PrizePool PDA; the tree creator no longer owns them.
				</p>
			</section>
		</div>
	);
}
