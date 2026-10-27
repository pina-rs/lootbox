/**
 * Token facts shared by the catalog API, the wallet holdings picker, and the
 * prize descriptions.
 */
import issuerMints from "../../../../tests/fixtures/issuer-stock-mints.json";
import snapshot from "./prestocks-snapshot.json";

export const CLASSIC_TOKEN_PROGRAM =
	"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

/**
 * Fixed mint/issuer pairs admitted by the program. Public delegate keys
 * alone are never proof of mint origin.
 */
export const STOCK_MINTS: ReadonlyMap<
	string,
	(typeof issuerMints.mints)[number]
> = new Map(
	issuerMints.mints.map((mint) => [mint.mint, mint]),
);

/** PreStocks mints and the company each tracks. */
export const PRESTOCKS: ReadonlyMap<string, string> = new Map(
	snapshot.stocks.map((stock) => [stock.mint, stock.name]),
);

/** PreStocks mints and their tickers, for wallets without token metadata. */
export const PRESTOCK_SYMBOLS: ReadonlyMap<string, string> = new Map(
	snapshot.stocks.map((stock) => [stock.mint, stock.symbol]),
);
