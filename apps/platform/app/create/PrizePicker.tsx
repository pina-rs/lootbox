/**
 * Add one prize to a bundle.
 *
 * Pick a type (SOL, meme coins and tokens, or stocks), type to search, pick a
 * result, and enter an amount in token units or in dollars or pounds. The
 * Worker checks the token against the program's admission rules before it
 * can be added, and offers to buy it with SOL through Jupiter when the
 * wallet is short.
 */
import { isAddress } from "@solana/kit";
import type { UiWalletAccount } from "@wallet-standard/react";
import {
	type KeyboardEvent,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";

import {
	type CatalogToken,
	compactUsd,
	displayName,
	type TokenCategory,
	tokenWarnings,
} from "../lib/catalog.js";
import { type Holding, looksLikeNft, type MintInfo } from "../lib/holdings.js";
import { formatUnits, parseUnits } from "../lib/plan.js";
import type { DraftAsset } from "../lib/schemas.js";
import { BuyWithSol } from "./BuyWithSol.js";
import type { Load } from "./hooks.js";
import { type Currency, usePrices } from "./prices.js";

type PrizeType = "sol" | TokenCategory | "nft";

type Props = Readonly<{
	account: UiWalletAccount;
	cluster: string;
	copies: number;
	holdings: Load<Holding[]>;
	nftPrizes: boolean;
	swaps: boolean;
	onRefreshHoldings: () => void;
	onAdd: (asset: DraftAsset) => void;
	onCancel: () => void;
}>;

const TYPES: readonly Readonly<
	{ value: PrizeType; label: string; hint: string }
>[] = [
	{ value: "sol", label: "Solana (SOL)", hint: "The simplest prize" },
	{
		value: "coin",
		label: "Meme coins & tokens",
		hint: "BONK, WIF, USDC, any mint",
	},
	{ value: "stock", label: "Stocks", hint: "PreStocks and xStocks" },
];

const WSOL = "So11111111111111111111111111111111111111112";

/** One option in the search list, from the catalog or the wallet. */
type Choice = Readonly<{
	token: CatalogToken;
	balance: bigint | null;
}>;

function holdingToToken(
	holding: Holding,
	category: TokenCategory,
): CatalogToken {
	return {
		mint: holding.mint,
		name: holding.name || holding.tracks ||
			`${holding.mint.slice(0, 4)}…${holding.mint.slice(-4)}`,
		symbol: holding.symbol ?? "",
		decimals: holding.decimals,
		icon: null,
		tokenProgram: holding.tokenProgram,
		category,
		verified: false,
		organicScore: null,
		usdPrice: null,
		liquidity: null,
		volume24h: null,
		issuer: holding.issuer?.name ?? (holding.tracks ? "PreStocks" : null),
		tracks: holding.tracks,
	};
}

function Monogram({ token }: Readonly<{ token: CatalogToken }>) {
	return token.icon && token.category === "coin"
		? <img className="token-icon" src={token.icon} alt="" loading="lazy" />
		: (
			<span className="token-icon token-mono" aria-hidden="true">
				{(token.tracks ?? token.symbol ?? "?").slice(0, 2).toUpperCase()}
			</span>
		);
}

function isStockHolding(holding: Holding): boolean {
	return holding.issuer !== null || holding.tracks !== null;
}

function useCatalog(category: TokenCategory, query: string) {
	const [state, setState] = useState<
		Readonly<
			{
				items: readonly CatalogToken[];
				loading: boolean;
				degraded: readonly string[];
			}
		>
	>({ items: [], loading: false, degraded: [] });

	useEffect(() => {
		const controller = new AbortController();
		const timer = setTimeout(() => {
			setState((current) => ({ ...current, loading: true }));
			fetch(`/api/tokens?category=${category}&q=${encodeURIComponent(query)}`, {
				signal: controller.signal,
			})
				.then((response) => response.json())
				.then((body: unknown) => {
					const items = typeof body === "object" && body !== null
						? Reflect.get(body, "items")
						: null;
					const degraded = typeof body === "object" && body !== null
						? Reflect.get(body, "degraded")
						: null;

					setState({
						// Our own API, typed by `searchCatalog`.
						items: Array.isArray(items) ? (items as CatalogToken[]) : [],
						loading: false,
						degraded: Array.isArray(degraded) ? (degraded as string[]) : [],
					});
				})
				.catch((error: unknown) => {
					if (error instanceof DOMException && error.name === "AbortError") {
						return;
					}

					setState({ items: [], loading: false, degraded: ["search"] });
				});
		}, 180);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [category, query]);

	return state;
}

function TokenSearch(
	{ category, holdings, onChoose }: Readonly<{
		category: TokenCategory;
		holdings: Load<Holding[]>;
		onChoose: (choice: Choice) => void;
	}>,
) {
	const id = useId();
	const input = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const catalog = useCatalog(category, query);
	const needle = query.trim().toLowerCase();
	const owned = holdings.status === "ready"
		? holdings.value.filter((holding) =>
			!looksLikeNft(holding) &&
			(category === "stock"
				? isStockHolding(holding)
				: !isStockHolding(holding))
		)
		: [];
	const choices = useMemo<Choice[]>(() => {
		const byMint = new Map<string, Choice>();
		const balances = new Map(
			owned.map((holding) => [holding.mint, holding.amount]),
		);

		for (const holding of owned) {
			const token = holdingToToken(holding, category);

			if (
				!needle ||
				[token.mint, token.name, token.symbol].some((value) =>
					value.toLowerCase().includes(needle)
				)
			) byMint.set(token.mint, { token, balance: holding.amount });
		}

		for (const token of catalog.items) {
			const held = byMint.get(token.mint);

			// Catalog data (logo, price, badges) wins; the wallet adds the balance.
			byMint.set(token.mint, {
				token,
				balance: held?.balance ?? balances.get(token.mint) ?? null,
			});
		}

		if (isAddress(query.trim()) && !byMint.has(query.trim())) {
			const mint = query.trim();

			byMint.set(mint, {
				token: {
					mint,
					name: "Token at this address",
					symbol: "",
					decimals: null,
					icon: null,
					tokenProgram: null,
					category,
					verified: false,
					organicScore: null,
					usdPrice: null,
					liquidity: null,
					volume24h: null,
					issuer: null,
					tracks: null,
				},
				balance: null,
			});
		}

		return [...byMint.values()].slice(0, 20);
	}, [owned, catalog.items, needle, query, category]);
	const listId = `${id}-list`;
	const optionId = (index: number) => `${id}-option-${index}`;

	useEffect(() => setActive(0), [query, category]);
	useEffect(() => input.current?.focus(), [category]);

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActive((index) => Math.min(index + 1, choices.length - 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActive((index) => Math.max(index - 1, 0));
		} else if (event.key === "Enter") {
			event.preventDefault();

			const choice = choices[active];

			if (choice) onChoose(choice);
		} else if (event.key === "Escape") {
			setQuery("");
		}
	};

	return (
		<div className="stack">
			<label htmlFor={id} className="field-label">
				{category === "stock" ? "Search stocks" : "Search tokens"}
			</label>
			<input
				ref={input}
				id={id}
				type="search"
				role="combobox"
				aria-expanded={choices.length > 0}
				aria-controls={listId}
				aria-autocomplete="list"
				aria-activedescendant={choices[active] ? optionId(active) : undefined}
				autoComplete="off"
				spellCheck={false}
				value={query}
				placeholder={category === "stock"
					? "Company, ticker, or mint"
					: "Name, ticker, or mint address"}
				onChange={(event) => setQuery(event.currentTarget.value)}
				onKeyDown={onKeyDown}
			/>
			<ul
				id={listId}
				role="listbox"
				className="picker-results"
				aria-label="Results"
			>
				{choices.map((choice, index) => {
					const { token } = choice;
					const warnings = tokenWarnings(token);

					return (
						<li
							key={token.mint}
							id={optionId(index)}
							role="option"
							aria-selected={index === active}
							data-active={index === active}
							onMouseEnter={() => setActive(index)}
							onClick={() => onChoose(choice)}
						>
							<Monogram token={token} />
							<span className="option-main">
								<span className="option-title">
									{displayName(token)}
									{token.symbol && (
										<span className="muted">{token.symbol}</span>
									)}
								</span>
								<span className="option-meta">
									{token.usdPrice !== null && (
										<span>{compactUsd(token.usdPrice)}</span>
									)}
									{token.volume24h !== null && (
										<span>Vol {compactUsd(token.volume24h)}</span>
									)}
									{token.liquidity !== null && (
										<span>Liq {compactUsd(token.liquidity)}</span>
									)}
									{choice.balance !== null && token.decimals !== null && (
										<span>
											You hold {formatUnits(choice.balance, token.decimals)}
										</span>
									)}
								</span>
							</span>
							<span className="option-badges">
								{token.issuer && <span className="badge">{token.issuer}</span>}
								{token.verified && (
									<span className="badge badge-ok">Verified</span>
								)}
								{choice.balance !== null && (
									<span className="badge">In wallet</span>
								)}
								{warnings.map((warning) => (
									<span key={warning} className="badge badge-warn">
										{warning}
									</span>
								))}
							</span>
						</li>
					);
				})}
			</ul>
			<p className="field-hint" aria-live="polite">
				{catalog.loading
					? "Searching…"
					: choices.length === 0
					? query
						? "No matches. Paste a mint address to use any token."
						: holdings.status === "loading"
						? "Reading your wallet…"
						: "Type to search."
					: `${choices.length} results. Use ↑ ↓ and Enter to choose.`}
				{catalog.degraded.length > 0 &&
					` Some sources are unavailable (${catalog.degraded.join(", ")}).`}
			</p>
		</div>
	);
}

type Admission =
	| Readonly<{ status: "checking" }>
	| Readonly<{ status: "ok"; info: MintInfo }>
	| Readonly<{ status: "refused"; reason: string }>;

function useAdmission(cluster: string, mint: string): Admission {
	const [state, setState] = useState<Admission>({ status: "checking" });

	useEffect(() => {
		let live = true;

		setState({ status: "checking" });
		fetch(`/api/admission?cluster=${cluster}&mint=${mint}`)
			.then((response) => response.json())
			.then((body: unknown) => {
				if (!live) return;

				const ok = typeof body === "object" && body !== null &&
					Reflect.get(body, "ok") === true;
				const reason = typeof body === "object" && body !== null
					? Reflect.get(body, "reason")
					: null;
				const info = typeof body === "object" && body !== null
					? Reflect.get(body, "info")
					: null;

				if (ok && typeof info === "object" && info !== null) {
					// Our own API: `mintInfos` with `supply` as a decimal string.
					const raw = info as Omit<MintInfo, "supply"> & { supply: string };

					setState({
						status: "ok",
						info: { ...raw, supply: BigInt(raw.supply) },
					});
				} else {
					setState({
						status: "refused",
						reason: typeof reason === "string"
							? reason
							: "This token can't be a prize.",
					});
				}
			})
			.catch(() =>
				live &&
				setState({
					status: "refused",
					reason: "Could not check this token. Try again.",
				})
			);

		return () => {
			live = false;
		};
	}, [cluster, mint]);

	return state;
}

/** Amount entry in token units, dollars, or pounds, with the conversion shown. */
function AmountInput(
	{ label, symbol, decimals, usdPrice, gbpPerUsd, onValue }: Readonly<{
		label: string;
		symbol: string;
		decimals: number;
		usdPrice: number | null;
		gbpPerUsd: number | null;
		onValue: (baseUnits: bigint | null) => void;
	}>,
) {
	const id = useId();
	const [currency, setCurrency] = useState<Currency>("units");
	const [value, setValue] = useState("");
	const perUnitFiat = currency === "usd"
		? usdPrice
		: currency === "gbp" && usdPrice !== null && gbpPerUsd !== null
		? usdPrice * gbpPerUsd
		: null;
	const units = currency === "units"
		? parseUnits(value, decimals)
		: perUnitFiat && Number(value) > 0
		? parseUnits(
			// Fiat conversions are approximate; six decimals is plenty.
			(Number(value) / perUnitFiat).toFixed(Math.min(decimals, 6)),
			decimals,
		)
		: null;
	const usd = units !== null && usdPrice !== null
		? (Number(units) / 10 ** decimals) * usdPrice
		: null;
	const currencies: readonly Readonly<{ value: Currency; label: string }>[] = [
		{ value: "units", label: symbol || "Tokens" },
		...(usdPrice !== null ? [{ value: "usd" as const, label: "$" }] : []),
		...(usdPrice !== null && gbpPerUsd !== null
			? [{ value: "gbp" as const, label: "£" }]
			: []),
	];

	useEffect(() => onValue(units), [units, onValue]);

	return (
		<div className="field">
			<label htmlFor={id}>{label}</label>
			<div className="amount-row">
				<input
					id={id}
					inputMode="decimal"
					value={value}
					autoComplete="off"
					aria-describedby={`${id}-conversion`}
					onChange={(event) => setValue(event.currentTarget.value)}
				/>
				{currencies.length > 1 && (
					<div className="segmented" role="radiogroup" aria-label="Amount in">
						{currencies.map((item) => (
							<label key={item.value}>
								<input
									type="radio"
									name={`${id}-currency`}
									checked={currency === item.value}
									onChange={() => {
										setCurrency(item.value);
										setValue("");
									}}
								/>
								{item.label}
							</label>
						))}
					</div>
				)}
			</div>
			<span id={`${id}-conversion`} className="field-hint">
				{units === null
					? currency === "units"
						? `Up to ${decimals} decimal places.`
						: "Enter a value."
					: currency === "units"
					? usd !== null
						? `≈ ${compactUsd(usd)} per box`
						: `${formatUnits(units, decimals)} ${symbol} per box`
					: `= ${formatUnits(units, decimals)} ${symbol} per box`}
			</span>
		</div>
	);
}

function SolForm(
	{ onAdd }: Readonly<{ onAdd: (asset: DraftAsset) => void }>,
) {
	const prices = usePrices([WSOL]);
	const [lamports, setLamports] = useState<bigint | null>(null);

	return (
		<form
			className="stack"
			onSubmit={(event) => {
				event.preventDefault();

				if (lamports && lamports > 0n) {
					onAdd({ kind: "sol", lamports: lamports.toString() });
				}
			}}
		>
			<AmountInput
				label="SOL per box"
				symbol="SOL"
				decimals={9}
				usdPrice={prices.usd[WSOL] ?? null}
				gbpPerUsd={prices.gbpPerUsd}
				onValue={setLamports}
			/>
			<button type="submit" className="button button-teal" disabled={!lamports}>
				Add SOL
			</button>
		</form>
	);
}

function TokenForm(
	{ account, choice, info, copies, swaps, onRefreshHoldings, onAdd, onBack }:
		Readonly<{
			account: UiWalletAccount;
			choice: Choice;
			info: MintInfo;
			copies: number;
			swaps: boolean;
			onRefreshHoldings: () => void;
			onAdd: (asset: DraftAsset) => void;
			onBack: () => void;
		}>,
) {
	const { token } = choice;
	const prices = usePrices([token.mint]);
	const usdPrice = prices.usd[token.mint] ?? token.usdPrice;
	const [amount, setAmount] = useState<bigint | null>(null);
	const needed = amount === null ? null : amount * BigInt(copies);
	const balance = choice.balance ?? 0n;
	const shortfall = needed !== null && needed > balance
		? needed - balance
		: null;
	const symbol = token.symbol || info.symbol || "tokens";
	const issuer = info.issuer;
	const tracks = token.tracks ?? info.tracks;

	return (
		<form
			className="stack"
			onSubmit={(event) => {
				event.preventDefault();

				if (!amount) return;

				onAdd({
					kind: "token",
					mint: info.mint,
					tokenProgram: info.tokenProgram,
					amount: amount.toString(),
					decimals: info.decimals,
					symbol,
					name: token.name,
					icon: token.icon,
					issuer,
					tracks,
					category: token.category,
					usdPrice,
				});
			}}
		>
			<div className="chosen">
				<Monogram token={token} />
				<span>
					<strong>{displayName({ ...token, tracks })}</strong>
					<small className="muted">
						{" "}
						{symbol} · {usdPrice !== null ? compactUsd(usdPrice) : "no price"}
						{" "}
						· you hold {formatUnits(balance, info.decimals)}
					</small>
				</span>
			</div>
			{issuer && (
				<p className="notice notice-quiet">
					{issuer.name}{" "}
					tokenized stock{tracks ? ` tracking ${tracks}` : ""}: an issuer token,
					not shares. {issuer.feeBasisPoints > 0
						? `The issuer charges a ${
							issuer.feeBasisPoints / 100
						}% transfer fee, so escrow takes a little extra and winners receive the amount minus the fee.`
						: "The issuer can freeze or claw back these tokens."}
				</p>
			)}
			<AmountInput
				label="Amount per box"
				symbol={symbol}
				decimals={info.decimals}
				usdPrice={usdPrice}
				gbpPerUsd={prices.gbpPerUsd}
				onValue={setAmount}
			/>
			{needed !== null && (
				<p className={shortfall ? "form-error" : "field-hint"}>
					{formatUnits(needed, info.decimals)} {symbol} for {copies}{" "}
					{copies === 1 ? "box" : "boxes"}
					{shortfall
						? `: you need ${formatUnits(shortfall, info.decimals)} more.`
						: "."}
				</p>
			)}
			{shortfall !== null && swaps && (
				<BuyWithSol
					account={account}
					mint={info.mint}
					symbol={symbol}
					decimals={info.decimals}
					shortfall={shortfall}
					tokenUsd={usdPrice}
					onBought={onRefreshHoldings}
				/>
			)}
			<div className="button-row">
				<button type="submit" className="button button-teal" disabled={!amount}>
					Add {symbol}
				</button>
				<button type="button" className="button button-quiet" onClick={onBack}>
					Pick another
				</button>
			</div>
		</form>
	);
}

function TokenStep(
	props: Readonly<{
		account: UiWalletAccount;
		category: TokenCategory;
		cluster: string;
		copies: number;
		holdings: Load<Holding[]>;
		swaps: boolean;
		onRefreshHoldings: () => void;
		onAdd: (asset: DraftAsset) => void;
	}>,
) {
	const [choice, setChoice] = useState<Choice | null>(null);

	if (!choice) {
		return (
			<TokenSearch
				category={props.category}
				holdings={props.holdings}
				onChoose={setChoice}
			/>
		);
	}

	return (
		<ChosenToken
			{...props}
			choice={choice}
			onBack={() => setChoice(null)}
		/>
	);
}

function ChosenToken(
	{ account, cluster, copies, swaps, choice, onRefreshHoldings, onAdd, onBack }:
		Readonly<{
			account: UiWalletAccount;
			cluster: string;
			copies: number;
			swaps: boolean;
			choice: Choice;
			onRefreshHoldings: () => void;
			onAdd: (asset: DraftAsset) => void;
			onBack: () => void;
		}>,
) {
	const admission = useAdmission(cluster, choice.token.mint);

	if (admission.status === "checking") {
		return (
			<p className="muted" role="status">Checking this token can be a prize…</p>
		);
	}

	if (admission.status === "refused") {
		return (
			<div className="stack">
				<p className="notice" role="alert" data-testid="admission-refused">
					<strong>{displayName(choice.token)}</strong>: {admission.reason}
				</p>
				<button type="button" className="button button-small" onClick={onBack}>
					Pick another
				</button>
			</div>
		);
	}

	return (
		<TokenForm
			account={account}
			choice={choice}
			info={admission.info}
			copies={copies}
			swaps={swaps}
			onRefreshHoldings={onRefreshHoldings}
			onAdd={onAdd}
			onBack={onBack}
		/>
	);
}

function NftList(
	{ holdings, onAdd }: Readonly<
		{ holdings: Load<Holding[]>; onAdd: (asset: DraftAsset) => void }
	>,
) {
	const nfts = holdings.status === "ready"
		? holdings.value.filter(looksLikeNft)
		: [];

	return (
		<ul className="picker-results" aria-label="NFTs">
			{nfts.map((nft) => (
				<li key={nft.mint}>
					<button
						type="button"
						onClick={() =>
							onAdd({
								kind: "nft",
								mint: nft.mint,
								standard: "tokenMetadata",
								name: nft.name ?? `NFT ${nft.mint.slice(0, 4)}…`,
								image: null,
							})}
					>
						{nft.name ?? nft.mint}
					</button>
				</li>
			))}
			{nfts.length === 0 && <li className="muted">No NFTs in this wallet.</li>}
		</ul>
	);
}

export function PrizePicker(
	{
		account,
		cluster,
		copies,
		holdings,
		nftPrizes,
		swaps,
		onRefreshHoldings,
		onAdd,
		onCancel,
	}: Props,
) {
	const [type, setType] = useState<PrizeType | null>(null);
	const types = nftPrizes
		? [...TYPES, { value: "nft" as const, label: "NFT", hint: "One of a kind" }]
		: TYPES;

	return (
		<div className="picker" role="group" aria-label="Add a prize">
			<div className="section-head">
				<strong>
					{type === null
						? "What kind of prize?"
						: types.find((item) => item.value === type)?.label}
				</strong>
				<span className="button-row">
					{type !== null && (
						<button
							type="button"
							className="button button-quiet button-small"
							onClick={() => setType(null)}
						>
							Change type
						</button>
					)}
					<button
						type="button"
						className="button button-quiet button-small"
						onClick={onCancel}
					>
						Cancel
					</button>
				</span>
			</div>
			{type === null && (
				<ul className="type-menu" aria-label="Prize types">
					{types.map((item) => (
						<li key={item.value}>
							<button type="button" onClick={() => setType(item.value)}>
								<strong>{item.label}</strong>
								<span className="muted">{item.hint}</span>
							</button>
						</li>
					))}
				</ul>
			)}
			{type === "sol" && <SolForm onAdd={onAdd} />}
			{(type === "coin" || type === "stock") && (
				<TokenStep
					key={type}
					account={account}
					category={type}
					cluster={cluster}
					copies={copies}
					holdings={holdings}
					swaps={swaps}
					onRefreshHoldings={onRefreshHoldings}
					onAdd={onAdd}
				/>
			)}
			{type === "nft" && <NftList holdings={holdings} onAdd={onAdd} />}
		</div>
	);
}
