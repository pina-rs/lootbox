/**
 * Add one prize to a bundle: SOL, a token from the wallet (or catalog, or a
 * pasted mint), or an NFT. Admission rules are checked before adding, so the
 * program never sees a prize it would refuse.
 */
import { isAddress } from "@solana/kit";
import { useEffect, useId, useMemo, useState } from "react";

import {
	type Holding,
	looksLikeNft,
	type MintInfo,
	mintInfos,
} from "../lib/holdings.js";
import { formatUnits, parseUnits } from "../lib/plan.js";
import type { DraftAsset } from "../lib/schemas.js";
import type { CatalogToken } from "../lib/tokens.js";
import type { Load } from "./hooks.js";

type Kind = "sol" | "token" | "nft";

type Props = Readonly<{
	rpcUrl: string;
	cluster: string;
	owner: string;
	copies: number;
	holdings: Load<Holding[]>;
	onAdd: (asset: DraftAsset) => void;
	onCancel: () => void;
}>;

type NftItem = Readonly<{
	mint: string;
	name: string;
	image: string | null;
	standard: "tokenMetadata" | "core";
}>;

function tokenLabel(
	info: Pick<MintInfo, "symbol" | "name" | "mint" | "tracks">,
) {
	if (info.tracks) return `${info.tracks} (PreStocks)`;

	return info.symbol || info.name ||
		`${info.mint.slice(0, 4)}…${info.mint.slice(-4)}`;
}

function SolForm({ onAdd }: Readonly<{ onAdd: (asset: DraftAsset) => void }>) {
	const [value, setValue] = useState("0.1");
	const lamports = parseUnits(value, 9);
	const id = useId();

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
			<div className="field">
				<label htmlFor={id}>SOL per box</label>
				<input
					id={id}
					inputMode="decimal"
					value={value}
					onChange={(event) => setValue(event.currentTarget.value)}
					aria-invalid={lamports === null || lamports === 0n ? true : undefined}
				/>
			</div>
			<button
				type="submit"
				className="button button-teal"
				disabled={!lamports || lamports === 0n}
			>
				Add SOL
			</button>
		</form>
	);
}

function TokenAmountForm(
	{ token, balance, copies, onAdd, onBack }: Readonly<{
		token: MintInfo & Readonly<{ icon: string | null; name: string | null }>;
		balance: bigint | null;
		copies: number;
		onAdd: (asset: DraftAsset) => void;
		onBack: () => void;
	}>,
) {
	const [value, setValue] = useState("");
	const id = useId();
	const amount = parseUnits(value, token.decimals);
	const needed = amount === null ? null : amount * BigInt(copies);
	const short = needed !== null && balance !== null && needed > balance;

	return (
		<form
			className="stack"
			onSubmit={(event) => {
				event.preventDefault();

				if (!amount || amount === 0n) return;

				onAdd({
					kind: "token",
					mint: token.mint,
					tokenProgram: token.tokenProgram,
					amount: amount.toString(),
					decimals: token.decimals,
					symbol: token.symbol ?? "",
					name: token.name ?? "",
					icon: token.icon,
					issuer: token.issuer,
					tracks: token.tracks,
				});
			}}
		>
			<p>
				<strong>{tokenLabel(token)}</strong>
				{balance !== null && (
					<span className="muted">
						· you hold {formatUnits(balance, token.decimals)}
					</span>
				)}
			</p>
			{token.issuer && (
				<p className="notice notice-quiet">
					{token.issuer.name} tokenized stock. {token.issuer.feeBasisPoints > 0
						? `The issuer charges a ${
							token.issuer.feeBasisPoints / 100
						}% transfer fee, so escrow takes a little extra and winners receive the amount minus the fee.`
						: "The issuer can freeze or claw back these tokens."}
				</p>
			)}
			<div className="field">
				<label htmlFor={id}>Amount per box</label>
				<input
					id={id}
					inputMode="decimal"
					value={value}
					autoFocus
					onChange={(event) => setValue(event.currentTarget.value)}
					aria-invalid={value !== "" && (amount === null || amount === 0n)
						? true
						: undefined}
					aria-describedby={`${id}-hint`}
				/>
				<span id={`${id}-hint`} className={short ? "form-error" : "field-hint"}>
					{needed === null
						? `Up to ${token.decimals} decimal places.`
						: short
						? `You need ${
							formatUnits(needed, token.decimals)
						} for ${copies} boxes.`
						: `${
							formatUnits(needed, token.decimals)
						} total for ${copies} boxes.`}
				</span>
			</div>
			<div className="button-row">
				<button
					type="submit"
					className="button button-teal"
					disabled={!amount || amount === 0n}
				>
					Add token
				</button>
				<button type="button" className="button button-quiet" onClick={onBack}>
					Pick another
				</button>
			</div>
		</form>
	);
}

function TokenPicker(
	{ rpcUrl, cluster, copies, holdings, onAdd }: Readonly<{
		rpcUrl: string;
		cluster: string;
		copies: number;
		holdings: Load<Holding[]>;
		onAdd: (asset: DraftAsset) => void;
	}>,
) {
	const [query, setQuery] = useState("");
	const [chosen, setChosen] = useState<
		(MintInfo & Readonly<{ icon: string | null; name: string | null }>) | null
	>(null);
	const [catalog, setCatalog] = useState<readonly CatalogToken[]>([]);
	const [pasted, setPasted] = useState<Load<MintInfo | null> | null>(null);
	const id = useId();
	const owned = holdings.status === "ready"
		? holdings.value.filter((holding) => !looksLikeNft(holding))
		: [];
	const filtered = owned.filter((holding) =>
		[
			holding.mint,
			holding.symbol ?? "",
			holding.name ?? "",
			holding.tracks ?? "",
		]
			.some((value) => value.toLowerCase().includes(query.trim().toLowerCase()))
	);

	// Catalog search only helps on mainnet, where catalog mints exist.
	useEffect(() => {
		if (cluster !== "mainnet") return;

		const controller = new AbortController();
		const timer = setTimeout(() => {
			fetch(`/api/tokens?q=${encodeURIComponent(query)}`, {
				signal: controller.signal,
			})
				.then((response) => response.json())
				.then((body: unknown) => {
					const items = typeof body === "object" && body !== null
						? Reflect.get(body, "items")
						: null;

					setCatalog(Array.isArray(items) ? (items as CatalogToken[]) : []);
				})
				.catch(() => setCatalog([]));
		}, 250);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [cluster, query]);

	// A pasted mint address is looked up directly on chain.
	useEffect(() => {
		const mint = query.trim();

		if (!isAddress(mint)) {
			setPasted(null);
			return;
		}

		let live = true;

		setPasted({ status: "loading" });
		mintInfos(rpcUrl, [mint]).then(
			(infos) =>
				live && setPasted({ status: "ready", value: infos.get(mint) ?? null }),
			(error: unknown) =>
				live &&
				setPasted({
					status: "error",
					message: error instanceof Error ? error.message : "Lookup failed",
				}),
		);

		return () => {
			live = false;
		};
	}, [query, rpcUrl]);

	if (chosen) {
		const holding = owned.find((item) => item.mint === chosen.mint);

		return (
			<TokenAmountForm
				token={chosen}
				balance={holding?.amount ?? null}
				copies={copies}
				onAdd={onAdd}
				onBack={() => setChosen(null)}
			/>
		);
	}

	const choose = async (mint: string, icon: string | null) => {
		const info = (await mintInfos(rpcUrl, [mint])).get(mint);

		if (info) setChosen({ ...info, icon });
	};

	return (
		<div className="stack">
			<div className="field">
				<label htmlFor={id}>Find a token</label>
				<input
					id={id}
					type="search"
					value={query}
					placeholder="Name, symbol, or mint address"
					onChange={(event) => setQuery(event.currentTarget.value)}
				/>
			</div>
			{holdings.status === "loading" && (
				<p className="muted">Reading your wallet…</p>
			)}
			{holdings.status === "error" && (
				<p className="form-error">
					Could not read your wallet: {holdings.message}
				</p>
			)}
			<ul className="picker-results" aria-label="Tokens">
				{pasted?.status === "ready" && pasted.value &&
					!owned.some((item) => item.mint === pasted.value?.mint) && (
					<TokenOption
						info={pasted.value}
						icon={null}
						balance={null}
						onChoose={choose}
					/>
				)}
				{filtered.map((holding) => (
					<TokenOption
						key={holding.mint}
						info={holding}
						icon={null}
						balance={holding.amount}
						onChoose={choose}
					/>
				))}
				{catalog.filter((token) =>
					!owned.some((item) => item.mint === token.mint)
				)
					.slice(0, 12)
					.map((token) => (
						<li key={token.mint}>
							<button
								type="button"
								onClick={() => void choose(token.mint, token.icon)}
							>
								{token.icon
									? <img className="token-icon" src={token.icon} alt="" />
									: <span className="token-icon" aria-hidden="true" />}
								<span>
									{token.tracks ? `${token.tracks} (PreStocks)` : token.symbol}
									<small className="muted">{token.name}</small>
								</span>
								<span className="badge">not in wallet</span>
							</button>
						</li>
					))}
			</ul>
			{pasted?.status === "ready" && !pasted.value && (
				<p className="form-error">
					No token mint at that address on this network.
				</p>
			)}
			{holdings.status === "ready" && filtered.length === 0 && !pasted && (
				<p className="muted">
					{owned.length === 0
						? "This wallet holds no tokens on this network. Paste a mint address to look one up."
						: "No match in your wallet."}
				</p>
			)}
		</div>
	);
}

function TokenOption(
	{ info, icon, balance, onChoose }: Readonly<{
		info: MintInfo;
		icon: string | null;
		balance: bigint | null;
		onChoose: (mint: string, icon: string | null) => Promise<void>;
	}>,
) {
	return (
		<li>
			<button
				type="button"
				disabled={info.ineligible !== null}
				title={info.ineligible ?? undefined}
				onClick={() => void onChoose(info.mint, icon)}
			>
				<span className="token-icon" aria-hidden="true" />
				<span>
					{tokenLabel(info)}
					{info.ineligible
						? <small className="form-error">{info.ineligible}</small>
						: balance !== null && (
							<small className="muted">
								· {formatUnits(balance, info.decimals)}
							</small>
						)}
				</span>
				{info.issuer && (
					<span className="badge badge-warn">{info.issuer.name}</span>
				)}
			</button>
		</li>
	);
}

function NftPicker(
	{ cluster, owner, holdings, onAdd }: Readonly<{
		cluster: string;
		owner: string;
		holdings: Load<Holding[]>;
		onAdd: (asset: DraftAsset) => void;
	}>,
) {
	const [das, setDas] = useState<
		Load<{ items: NftItem[]; message: string | null }>
	>({
		status: "loading",
	});

	useEffect(() => {
		let live = true;

		fetch(`/api/nfts?owner=${owner}&cluster=${cluster}`)
			.then((response) => response.json())
			.then((body: unknown) => {
				if (!live) return;

				const items = typeof body === "object" && body !== null
					? Reflect.get(body, "items")
					: null;
				const message = typeof body === "object" && body !== null
					? Reflect.get(body, "message")
					: null;

				setDas({
					status: "ready",
					value: {
						items: Array.isArray(items) ? (items as NftItem[]) : [],
						message: typeof message === "string" ? message : null,
					},
				});
			})
			.catch(() =>
				live && setDas({ status: "error", message: "NFT lookup failed" })
			);

		return () => {
			live = false;
		};
	}, [owner, cluster]);

	const fromWallet: NftItem[] = holdings.status === "ready"
		? holdings.value.filter(looksLikeNft).map((holding) => ({
			mint: holding.mint,
			name: holding.name ?? `NFT ${holding.mint.slice(0, 4)}…`,
			image: null,
			standard: "tokenMetadata" as const,
		}))
		: [];
	const items = useMemo(() => {
		const all = new Map<string, NftItem>();

		for (const item of fromWallet) all.set(item.mint, item);

		if (das.status === "ready") {
			for (const item of das.value.items) all.set(item.mint, item);
		}

		return [...all.values()];
	}, [fromWallet, das]);

	return (
		<div className="stack">
			<p className="field-hint">
				An NFT is one of a kind, so its bundle holds exactly one box.
			</p>
			<ul className="picker-results" aria-label="NFTs">
				{items.map((item) => (
					<li key={item.mint}>
						<button
							type="button"
							onClick={() =>
								onAdd({
									kind: "nft",
									mint: item.mint,
									standard: item.standard,
									name: item.name,
									image: item.image,
								})}
						>
							{item.image
								? <img className="token-icon" src={item.image} alt="" />
								: <span className="token-icon" aria-hidden="true" />}
							<span>{item.name}</span>
							<span className="badge">
								{item.standard === "core" ? "Core" : "NFT"}
							</span>
						</button>
					</li>
				))}
			</ul>
			{items.length === 0 && das.status !== "loading" && (
				<p className="muted">
					{das.status === "ready" && das.value.message
						? das.value.message
						: "No NFTs found in this wallet."}
				</p>
			)}
		</div>
	);
}

export function PrizePicker(
	{ rpcUrl, cluster, owner, copies, holdings, onAdd, onCancel }: Props,
) {
	const [kind, setKind] = useState<Kind>("sol");
	const name = useId();

	return (
		<div className="picker" role="group" aria-label="Add a prize">
			<div className="section-head">
				<fieldset className="segmented">
					<legend className="visually-hidden">Prize type</legend>
					{(["sol", "token", "nft"] as const).map((value) => (
						<label key={value}>
							<input
								type="radio"
								name={name}
								checked={kind === value}
								onChange={() => setKind(value)}
							/>
							{value === "sol" ? "SOL" : value === "token" ? "Token" : "NFT"}
						</label>
					))}
				</fieldset>
				<button
					type="button"
					className="button button-quiet button-small"
					onClick={onCancel}
				>
					Cancel
				</button>
			</div>
			{kind === "sol" && <SolForm onAdd={onAdd} />}
			{kind === "token" && (
				<TokenPicker
					rpcUrl={rpcUrl}
					cluster={cluster}
					copies={copies}
					holdings={holdings}
					onAdd={onAdd}
				/>
			)}
			{kind === "nft" && (
				<NftPicker
					cluster={cluster}
					owner={owner}
					holdings={holdings}
					onAdd={onAdd}
				/>
			)}
		</div>
	);
}
