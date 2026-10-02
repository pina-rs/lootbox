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

/** PreStocks mints and the company each tracks. */
export const PRESTOCKS: ReadonlyMap<string, string> = new Map(
	snapshot.stocks.map((stock) => [stock.mint, stock.name]),
);

/** PreStocks mints and their tickers, for wallets without token metadata. */
export const PRESTOCK_SYMBOLS: ReadonlyMap<string, string> = new Map(
	snapshot.stocks.map((stock) => [stock.mint, stock.symbol]),
);
