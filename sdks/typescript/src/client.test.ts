import {
	AccountRole,
	address,
	createNoopSigner,
	getAddressDecoder,
	getAddressEncoder,
	type Instruction,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
	assertFundedPrizeMatches,
	bundleAssets,
	composeWinnerRoutedSolQuoteClaim,
	composeWinnerRoutedTokenQuoteClaim,
	partitionPrizeDeliveryInstructions,
	readU64,
} from "./client.js";

const payer = address("Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op");

function instructionWithAccounts(offset: number, count: number): Instruction {
	return Object.freeze({
		programAddress: address("11111111111111111111111111111111"),
		accounts: Object.freeze(Array.from({ length: count }, (_, index) => {
			const bytes = new Uint8Array(32);
			bytes[0] = offset + index + 1;
			return Object.freeze({
				address: getAddressDecoder().decode(bytes),
				role: AccountRole.READONLY,
			});
		})),
		data: new Uint8Array(32),
	});
}

describe("chain prize decoding", () => {
	it("keeps each prize atomic while splitting oversized bundle delivery", () => {
		const first = [
			instructionWithAccounts(0, 10),
			instructionWithAccounts(10, 10),
		];
		const second = [
			instructionWithAccounts(20, 10),
			instructionWithAccounts(30, 10),
		];
		const batches = partitionPrizeDeliveryInstructions(payer, [first, second]);
		expect(batches).toHaveLength(2);
		expect(batches[0]).toEqual(first);
		expect(batches[1]).toEqual(second);
	});

	it("rejects a single prize that cannot fit in one transaction", () => {
		expect(() =>
			partitionPrizeDeliveryInstructions(payer, [[
				instructionWithAccounts(0, 65),
			]])
		).toThrow(/one prize delivery exceeds/);
	});

	it("uses the program's zero-based SOL/token/NFT tags", () => {
		const mint = address("Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op");
		const mints = new Uint8Array(128);
		mints.set(getAddressEncoder().encode(mint), 32);
		mints.set(getAddressEncoder().encode(mint), 64);
		const amounts = new Uint8Array(32);
		[100_000_000n, 100n, 1n].forEach((amount, index) =>
			new DataView(amounts.buffer).setBigUint64(index * 8, amount, true)
		);
		const assets = bundleAssets({
			assetCount: 3,
			kinds: new Uint8Array([0, 1, 2, 0]),
			mints,
			amounts,
			decimals: new Uint8Array([9, 0, 0, 0]),
		});
		expect(assets.map(({ kind, amount }) => ({ kind, amount }))).toEqual([
			{ kind: "sol", amount: 100_000_000n },
			{ kind: "token", amount: 100n },
			{ kind: "nft", amount: 1n },
		]);
		expect(assets[2]?.mint).toBe(mint);
	});
	it("decodes dynamic kinds and rejects unknown prize tags", () => {
		const dynamic = bundleAssets({
			assetCount: 3,
			kinds: new Uint8Array([7, 8, 9]),
			mints: new Uint8Array(128),
			amounts: new Uint8Array(32),
			decimals: new Uint8Array(4),
		});
		expect(dynamic.map((asset) => asset.kind)).toEqual([
			"quoteSol",
			"quoteToken",
			"mintBadge",
		]);
		expect(() =>
			bundleAssets({
				assetCount: 1,
				kinds: new Uint8Array([10]),
				mints: new Uint8Array(128),
				amounts: new Uint8Array(32),
				decimals: new Uint8Array(4),
			})
		).toThrow(/invalid prize/);
	});
	it("requires the bound winner to sign an appended quote route", () => {
		const program = address(
			"Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op",
		);
		const winner = createNoopSigner(program);
		const base = {
			template: program,
			opening: program,
			bundle: program,
			assetIndex: 0,
			winner,
		};
		expect(() =>
			composeWinnerRoutedSolQuoteClaim({
				...base,
				route: [{ programAddress: program, data: new Uint8Array() }],
			})
		).toThrow(/winner must sign/);
		const composed = composeWinnerRoutedSolQuoteClaim({
			...base,
			route: [{
				programAddress: program,
				data: new Uint8Array(),
				accounts: [{
					address: winner.address,
					role: AccountRole.READONLY_SIGNER,
				}],
			}],
		});
		expect(composed).toHaveLength(2);
		expect(composed[1]?.accounts?.[0]).toMatchObject({
			address: winner.address,
			signer: winner,
		});
		const tokenComposed = composeWinnerRoutedTokenQuoteClaim({
			...base,
			mint: program,
			escrow: program,
			destination: program,
			tokenProgram: program,
			route: composed.slice(1),
		});
		expect(tokenComposed).toHaveLength(2);
		expect(tokenComposed[0]?.programAddress).toBe(program);
	});
	it("preserves all 64 amount bits", () => {
		const bytes = new Uint8Array(8).fill(255);
		expect(readU64(bytes, 0)).toBe((1n << 64n) - 1n);
		expect(() => readU64(bytes, 1)).toThrow();
	});
	it("rejects a changed asset when append funding resumes", () => {
		const storedMint = address(
			"Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op",
		);
		const changedMint = address("11111111111111111111111111111111");
		const mints = new Uint8Array(128);
		mints.set(getAddressEncoder().encode(storedMint));
		const amounts = new Uint8Array(32);
		new DataView(amounts.buffer).setBigUint64(0, 100n, true);
		const bundle = {
			assetCount: 1,
			kinds: new Uint8Array([1, 0, 0, 0]),
			mints,
			amounts,
			decimals: new Uint8Array([0, 0, 0, 0]),
		};

		expect(() =>
			assertFundedPrizeMatches(bundle, 0, {
				kind: "token",
				mint: storedMint,
				amount: 100n,
			})
		).not.toThrow();
		expect(() =>
			assertFundedPrizeMatches(bundle, 0, {
				kind: "token",
				mint: changedMint,
				amount: 100n,
			})
		).toThrow(/saved prize differs/);
	});
});
