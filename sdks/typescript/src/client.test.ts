import { address, getAddressEncoder } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { bundleAssets, readU64 } from "./client.js";

describe("chain prize decoding", () => {
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
	it("rejects unknown prize tags instead of silently treating them as tokens", () => {
		expect(() =>
			bundleAssets({
				assetCount: 1,
				kinds: new Uint8Array([7]),
				mints: new Uint8Array(128),
				amounts: new Uint8Array(32),
				decimals: new Uint8Array(4),
			})
		).toThrow(/invalid prize/);
	});
	it("preserves all 64 amount bits", () => {
		const bytes = new Uint8Array(8).fill(255);
		expect(readU64(bytes, 0)).toBe((1n << 64n) - 1n);
		expect(() => readU64(bytes, 1)).toThrow();
	});
});
