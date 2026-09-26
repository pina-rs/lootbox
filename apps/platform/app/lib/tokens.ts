/**
 * Token facts shared by the catalog API, the wallet holdings picker, and the
 * prize descriptions.
 */
import snapshot from "./prestocks-snapshot.json";

export const CLASSIC_TOKEN_PROGRAM =
	"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

/**
 * Permanent delegates the program admits as issuer-controlled tokenized
 * stocks (see `programs/lootbox_program/src/templates/issuer_stock.rs`).
 */
export const STOCK_ISSUERS: Readonly<Record<string, string>> = {
	WV9PJN7XTmTLVwbutCLFxp8TyePee6Xq5mRq6Fti5Wc: "PreStocks",
	"5aMNNLQJwAEeoemTEMkv5NVjqKwvvefRYCQ5Z67HFvEq": "Backed xStocks",
};

export type CatalogToken = Readonly<{
	mint: string;
	name: string;
	symbol: string;
	decimals: number;
	icon: string | null;
	tokenProgram: string;
	verified: boolean;
	/** Company a PreStocks token tracks. */
	tracks: string | null;
}>;

/** PreStocks mints and the company each tracks. */
export const PRESTOCKS: ReadonlyMap<string, string> = new Map(
	snapshot.stocks.map((stock) => [stock.mint, stock.name]),
);

/** A small verified starter list used when the live catalog is unavailable. */
export const FALLBACK_TOKENS: readonly CatalogToken[] = [
	{
		mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		name: "USD Coin",
		symbol: "USDC",
		decimals: 6,
		icon: null,
		tokenProgram: CLASSIC_TOKEN_PROGRAM,
		verified: true,
		tracks: null,
	},
	{
		mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6XKj7D3WpqkDmzPK",
		name: "Bonk",
		symbol: "BONK",
		decimals: 5,
		icon: null,
		tokenProgram: CLASSIC_TOKEN_PROGRAM,
		verified: true,
		tracks: null,
	},
	...snapshot.stocks.map((stock) => ({
		mint: stock.mint,
		name: `${stock.name} (PreStocks)`,
		symbol: stock.symbol,
		decimals: 9,
		icon: null,
		tokenProgram: TOKEN_2022_PROGRAM,
		verified: true,
		tracks: stock.name,
	})),
];

export function matchesQuery(token: CatalogToken, query: string): boolean {
	const needle = query.trim().toLowerCase();

	return !needle ||
		[token.mint, token.name, token.symbol].some((value) =>
			value.toLowerCase().includes(needle)
		);
}
