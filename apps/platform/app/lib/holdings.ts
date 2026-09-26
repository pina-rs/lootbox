/**
 * What a creator can put in a box: the wallet's tokens and NFTs, read from
 * RPC, with the admission rules the program enforces checked up front.
 */
import { fetchAllMaybeMint, type Mint } from "@solana-program/token-2022";
import { address, createSolanaRpc, isAddress, isSome } from "@solana/kit";

import {
	CLASSIC_TOKEN_PROGRAM,
	PRESTOCK_SYMBOLS,
	PRESTOCKS,
	STOCK_ISSUERS,
	TOKEN_2022_PROGRAM,
} from "./tokens.js";

export type IssuerInfo = Readonly<{
	name: string;
	feeBasisPoints: number;
	maximumFee: string;
}>;

export type MintInfo = Readonly<{
	mint: string;
	tokenProgram: string;
	decimals: number;
	supply: bigint;
	name: string | null;
	symbol: string | null;
	issuer: IssuerInfo | null;
	tracks: string | null;
	/** Why the program would refuse this mint as a prize, or `null`. */
	ineligible: string | null;
}>;

export type Holding = MintInfo & Readonly<{ amount: bigint }>;

/** Token-2022 extensions any fungible prize may carry. */
const STRICT_EXTENSIONS = new Set(["MetadataPointer", "TokenMetadata"]);
/** Extra extensions only an issuer-controlled stock may carry. */
const ISSUER_EXTENSIONS = new Set([
	"PermanentDelegate",
	"DefaultAccountState",
	"ScaledUiAmountConfig",
	"PausableConfig",
	"ConfidentialTransferMint",
	"TransferHook",
	"TransferFeeConfig",
]);

/** Apply the program's prize admission rules to one decoded mint. */
export function describeMint(
	mintAddress: string,
	owner: string,
	mint: Mint,
	epoch: bigint,
): MintInfo {
	const extensions = isSome(mint.extensions) ? mint.extensions.value : [];
	const delegate = extensions.find((entry) =>
		entry.__kind === "PermanentDelegate"
	);
	const issuerName = delegate?.__kind === "PermanentDelegate"
		? STOCK_ISSUERS[delegate.delegate] ?? null
		: null;
	const metadata = extensions.find((entry) => entry.__kind === "TokenMetadata");
	const feeConfig = extensions.find((entry) =>
		entry.__kind === "TransferFeeConfig"
	);
	const schedule = feeConfig?.__kind === "TransferFeeConfig"
		? epoch >= feeConfig.newerTransferFee.epoch
			? feeConfig.newerTransferFee
			: feeConfig.olderTransferFee
		: null;
	const allowed = issuerName
		? new Set([...STRICT_EXTENSIONS, ...ISSUER_EXTENSIONS])
		: STRICT_EXTENSIONS;
	const blocked = extensions.find((entry) => !allowed.has(entry.__kind));
	let ineligible: string | null = null;

	if (owner !== CLASSIC_TOKEN_PROGRAM && owner !== TOKEN_2022_PROGRAM) {
		ineligible = "This address isn't a token mint.";
	} else if (blocked) {
		ineligible =
			`This token uses the ${blocked.__kind} extension, which the lootbox program can't escrow safely — not supported.`;
	} else if (isSome(mint.freezeAuthority) && !issuerName) {
		ineligible = "This token's issuer can freeze balances — not supported.";
	}

	return {
		mint: mintAddress,
		tokenProgram: owner,
		decimals: mint.decimals,
		supply: mint.supply,
		name: metadata?.__kind === "TokenMetadata" ? metadata.name : null,
		symbol: metadata?.__kind === "TokenMetadata"
			? metadata.symbol
			: PRESTOCK_SYMBOLS.get(mintAddress) ?? null,
		issuer: issuerName
			? {
				name: issuerName,
				feeBasisPoints: schedule?.transferFeeBasisPoints ?? 0,
				maximumFee: (schedule?.maximumFee ?? 0n).toString(),
			}
			: null,
		tracks: PRESTOCKS.get(mintAddress) ?? null,
		ineligible,
	};
}

/** Read mints (classic or Token-2022) with their admission verdicts. */
export async function mintInfos(
	rpcUrl: string,
	mints: readonly string[],
): Promise<Map<string, MintInfo>> {
	const rpc = createSolanaRpc(rpcUrl);
	const valid = mints.filter((mint) => isAddress(mint)).map((mint) =>
		address(mint)
	);
	const infos = new Map<string, MintInfo>();

	if (valid.length === 0) return infos;

	const [{ epoch }, accounts] = await Promise.all([
		rpc.getEpochInfo().send(),
		fetchAllMaybeMint(rpc, valid),
	]);

	for (const account of accounts) {
		if (!account.exists) continue;

		infos.set(
			account.address,
			describeMint(
				account.address,
				account.programAddress,
				account.data,
				epoch,
			),
		);
	}

	return infos;
}

type ParsedTokenAccount = Readonly<{
	account: Readonly<{
		data: Readonly<{
			parsed: Readonly<{
				info: Readonly<{
					mint: string;
					tokenAmount: Readonly<{ amount: string; decimals: number }>;
				}>;
			}>;
		}>;
	}>;
}>;

/** Every token the wallet holds a positive balance of, on both programs. */
export async function walletHoldings(
	rpcUrl: string,
	owner: string,
): Promise<Holding[]> {
	const rpc = createSolanaRpc(rpcUrl);
	const programs = [CLASSIC_TOKEN_PROGRAM, TOKEN_2022_PROGRAM];
	const responses = await Promise.all(
		programs.map((programId) =>
			rpc.getTokenAccountsByOwner(
				address(owner),
				{ programId: address(programId) },
				{ encoding: "jsonParsed" },
			).send()
		),
	);
	const balances = new Map<string, bigint>();

	for (const response of responses) {
		for (const entry of response.value as readonly ParsedTokenAccount[]) {
			const info = entry.account.data.parsed.info;
			const amount = BigInt(info.tokenAmount.amount);

			if (amount === 0n) continue;

			balances.set(info.mint, (balances.get(info.mint) ?? 0n) + amount);
		}
	}

	const infos = await mintInfos(rpcUrl, [...balances.keys()]);

	return [...balances].flatMap(([mint, amount]) => {
		const info = infos.get(mint);

		return info ? [{ ...info, amount }] : [];
	});
}

/** A zero-decimal, one-of-one token is a (legacy or Token Metadata) NFT. */
export function looksLikeNft(
	info: Pick<MintInfo, "decimals" | "supply">,
): boolean {
	return info.decimals === 0 && info.supply === 1n;
}

export async function solBalance(
	rpcUrl: string,
	owner: string,
): Promise<bigint> {
	const { value } = await createSolanaRpc(rpcUrl).getBalance(address(owner))
		.send();

	return value;
}
