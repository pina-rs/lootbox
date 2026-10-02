import type { Mint } from "@solana-program/token-2022";
import { address, none, some } from "@solana/kit";
import { describe, expect, it } from "vitest";

import { describeMint } from "./holdings.js";
import { CLASSIC_TOKEN_PROGRAM, TOKEN_2022_PROGRAM } from "./tokens.js";

const MINT = "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF";
const PRESTOCKS = address("WV9PJN7XTmTLVwbutCLFxp8TyePee6Xq5mRq6Fti5Wc");
const SOMEONE = address("3SWqQpWP5AUyJA5c7kLQdgwP83BLL9p8EH1DkfLTZ3pj");

function mint(overrides: Partial<Mint>): Mint {
	return {
		mintAuthority: none(),
		supply: 1_000n,
		decimals: 9,
		isInitialized: true,
		freezeAuthority: none(),
		extensions: none(),
		...overrides,
	};
}

describe("prize admission (mirrors the program)", () => {
	it("admits a plain classic token", () => {
		expect(describeMint(MINT, CLASSIC_TOKEN_PROGRAM, mint({}), 0n).ineligible)
			.toBeNull();
	});

	it("refuses a token whose issuer can freeze balances", () => {
		expect(
			describeMint(
				MINT,
				CLASSIC_TOKEN_PROGRAM,
				mint({ freezeAuthority: some(SOMEONE) }),
				0n,
			)
				.ineligible,
		).toBe("This token's issuer can freeze balances — not supported.");
	});

	it("refuses behaviour-changing Token-2022 extensions without an allowed issuer", () => {
		const hooked = mint({
			extensions: some([{
				__kind: "TransferHook",
				authority: SOMEONE,
				programId: SOMEONE,
			}]),
		});

		expect(describeMint(MINT, TOKEN_2022_PROGRAM, hooked, 0n).ineligible)
			.toMatch(/TransferHook extension/);
	});

	it("admits an allow-listed issuer stock and reads its current fee", () => {
		const stock = mint({
			freezeAuthority: some(PRESTOCKS),
			extensions: some([
				{ __kind: "PermanentDelegate", delegate: PRESTOCKS },
				{
					__kind: "TransferFeeConfig",
					transferFeeConfigAuthority: PRESTOCKS,
					withdrawWithheldAuthority: PRESTOCKS,
					withheldAmount: 0n,
					olderTransferFee: {
						epoch: 0n,
						maximumFee: 5n,
						transferFeeBasisPoints: 50,
					},
					newerTransferFee: {
						epoch: 10n,
						maximumFee: 9n,
						transferFeeBasisPoints: 100,
					},
				},
			]),
		});
		const early = describeMint(MINT, TOKEN_2022_PROGRAM, stock, 5n);
		const later = describeMint(MINT, TOKEN_2022_PROGRAM, stock, 10n);

		expect(early.ineligible).toBeNull();
		expect(early.issuer).toEqual({
			name: "PreStocks",
			feeBasisPoints: 50,
			maximumFee: "5",
		});
		expect(later.issuer?.feeBasisPoints).toBe(100);
		expect(early.tracks).toBe("OpenAI");
	});

	it("refuses accounts that are not token mints", () => {
		expect(describeMint(MINT, SOMEONE, mint({}), 0n).ineligible)
			.toBe("This address isn't a token mint.");
	});
});
