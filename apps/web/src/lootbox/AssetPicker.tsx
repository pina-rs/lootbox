import {
	Check,
	Coins,
	Image,
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
	makeAsset,
	type NftSearchResult,
	searchNfts,
	searchTokens,
	type TokenSearchResult,
} from "./playground.js";

type Tab = "tokens" | "nfts" | "manual";
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
	const [nftOwner, setNftOwner] = useState(owner);
	const [tokens, setTokens] = useState(emptyTokens);
	const [nfts, setNfts] = useState(emptyNfts);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [manualKind, setManualKind] = useState<"token" | "nft">("token");
	const [manualMint, setManualMint] = useState("");
	const [manualLabel, setManualLabel] = useState("");
	const [manualDecimals, setManualDecimals] = useState("0");

	useEffect(() => {
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
			if (event.key === "Escape") close.current();
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
			document.removeEventListener("keydown", keydown);
			previous?.focus();
		};
	}, []);

	useEffect(() => {
		if (tab === "manual") return;
		const timer = setTimeout(() => {
			setLoading(true);
			setError("");
			const request = tab === "tokens"
				? searchTokens(query).then(setTokens)
				: searchNfts(nftOwner, query).then(setNfts);
			void request.catch((reason: unknown) => {
				setError(
					reason instanceof Error ? reason.message : "Asset search failed",
				);
			}).finally(() => setLoading(false));
		}, 320);
		return () => clearTimeout(timer);
	}, [nftOwner, query, tab]);

	const add = (asset: DraftAsset) => {
		onPick(asset);
		onClose();
	};
	const source = tab === "tokens" ? tokens : nfts;

	return (
		<div
			className="asset-picker-backdrop"
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<section
				ref={dialog}
				className="asset-picker"
				role="dialog"
				aria-modal="true"
				aria-labelledby="asset-picker-title"
			>
				<header>
					<div>
						<span className="eyebrow">TREASURY CATALOG</span>
						<h2 id="asset-picker-title">Add an asset</h2>
					</div>
					<button
						type="button"
						className="icon-button"
						aria-label="Close asset picker"
						onClick={onClose}
					>
						<X size={19} />
					</button>
				</header>
				<nav aria-label="Asset source">
					{([["tokens", "Jupiter tokens", Coins], [
						"nfts",
						"Wallet NFTs",
						Image,
					], ["manual", "Manual", Pencil]] as const).map((
						[value, label, Icon],
					) => (
						<button
							type="button"
							key={value}
							aria-current={tab === value ? "page" : undefined}
							onClick={() => setTab(value)}
						>
							<Icon size={16} />
							{label}
						</button>
					))}
				</nav>

				{tab !== "manual"
					? (
						<>
							{tab === "nfts" && (
								<label className="field">
									Wallet address
									<input
										value={nftOwner}
										spellCheck={false}
										onChange={(event) => setNftOwner(event.target.value)}
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
									: nfts.items.map((nft) => (
										<button
											type="button"
											key={nft.id}
											onClick={() =>
												add({
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
											<i>{nft.compressed ? "COMPRESSED" : "NFT"}</i>
										</button>
									))}
								{!loading && source.items.length === 0 && (
									<div className="catalog-empty">
										<Sparkles size={24} />
										<p>No matching assets.</p>
										<span>Try a mint address or switch to Manual.</span>
									</div>
								)}
							</div>
						</>
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
				</footer>
				<p className="picker-disclosure">
					The local playground mirrors catalog selections as valueless Surfpool
					assets. The SDK uses the selected mint and standard on real clusters.
				</p>
			</section>
		</div>
	);
}
