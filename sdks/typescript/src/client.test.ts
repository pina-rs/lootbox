import {
	MAX_BUBBLEGUM_PROOF_ACCOUNTS,
	withBubblegumProofAccounts,
} from "@pina-rs/lootbox-program-client";
import {
	type AccountMeta,
	AccountRole,
	type Address,
	address,
	createNoopSigner,
	getAddressDecoder,
	getAddressEncoder,
	getProgramDerivedAddress,
	getU64Encoder,
	type Instruction,
	type InstructionWithAccounts,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
	assertFundedPrizeMatches,
	boundedRejectionTarget,
	BUBBLEGUM_PROGRAM,
	bundleAssets,
	composeWinnerRoutedSolQuoteClaim,
	composeWinnerRoutedTokenQuoteClaim,
	partitionPrizeDeliveryInstructions,
	prizePoolCommitment,
	prizePoolManifestAccumulator,
	readU64,
	validateCompressedNftIdentity,
} from "./client.js";

const payer = address("Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op");

function bubblegumMetadata(
	input: Readonly<{
		uri?: string;
		mutable?: boolean;
		collectionVerified?: boolean;
		creatorVerified?: boolean;
	}> = {},
): Uint8Array {
	const parts: number[] = [];
	const pushU16 = (value: number) => {
		parts.push(value & 0xff, value >>> 8);
	};
	const pushU32 = (value: number) => {
		parts.push(
			value & 0xff,
			(value >>> 8) & 0xff,
			(value >>> 16) & 0xff,
			value >>> 24,
		);
	};
	const pushString = (value: string) => {
		const bytes = new TextEncoder().encode(value);
		pushU32(bytes.length);
		parts.push(...bytes);
	};

	pushString("Pool prize");
	pushString("POOL");
	pushString(input.uri ?? "https://example.com/1.json");
	pushU16(500);
	parts.push(0, Number(input.mutable ?? false)); // primary sale + mutability
	parts.push(0, 0); // no edition nonce + no token standard
	parts.push(
		1,
		Number(input.collectionVerified ?? false),
		...new Uint8Array(32).fill(4),
	);
	parts.push(0); // no uses
	parts.push(0); // original TokenProgramVersion
	pushU32(1);
	parts.push(...new Uint8Array(32).fill(5));
	parts.push(Number(input.creatorVerified ?? false), 100);
	return Uint8Array.from(parts);
}

function instructionWithAccounts(
	offset: number,
	count: number,
): Instruction & InstructionWithAccounts<readonly AccountMeta[]> {
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
	it("rejects noncanonical and oversized compressed-NFT witnesses", async () => {
		const tree = address("7RmhTYBS7Uv9PSNmJGX6tM8BjSn7HVbGdVgV6EtCNKLm");
		const proof = {
			tree,
			treeConfig: payer,
			root: new Uint8Array(32),
			dataHash: new Uint8Array(32),
			creatorHash: new Uint8Array(32),
			nonce: 7n,
			leafIndex: 7,
			proof: [] as readonly Address[],
		};
		const [asset] = await getProgramDerivedAddress({
			programAddress: BUBBLEGUM_PROGRAM,
			seeds: [
				new TextEncoder().encode("asset"),
				getAddressEncoder().encode(tree),
				getU64Encoder().encode(7n),
			],
		});
		await expect(validateCompressedNftIdentity(asset, proof)).resolves
			.toBeUndefined();
		await expect(validateCompressedNftIdentity(payer, proof)).rejects.toThrow(
			/does not match/,
		);
		await expect(validateCompressedNftIdentity(asset, {
			...proof,
			proof: Array(17).fill(payer),
		})).rejects.toThrow(/protocol limit/);
	});

	it("expands generated Bubblegum proof placeholders and enforces the cap", () => {
		const base = instructionWithAccounts(0, 2);
		const empty = withBubblegumProofAccounts(base, []);
		expect(empty.accounts).toHaveLength(1);
		const proof = [
			address("11111111111111111111111111111111"),
			payer,
		] as const;
		const expanded = withBubblegumProofAccounts(base, proof);
		expect(expanded.accounts.slice(1).map(({ address }) => address)).toEqual(
			proof,
		);
		expect(() =>
			withBubblegumProofAccounts(
				base,
				Array(MAX_BUBBLEGUM_PROOF_ACCOUNTS + 1).fill(payer),
			)
		).toThrow(/at most 16/);
	});

	it("fails closed when all eight unbiased sampler candidates are rejected", () => {
		const total = 0xffff_ffffn;
		expect(() => boundedRejectionTarget(Array(8).fill(0n), total)).toThrow(
			/entropy rejection exhausted/,
		);
		expect(boundedRejectionTarget([0n, 1n], total)).toBe(1n);
	});
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
			assetCount: 4,
			kinds: new Uint8Array([7, 8, 9, 10]),
			mints: new Uint8Array(128),
			amounts: new Uint8Array(32),
			decimals: new Uint8Array(4),
		});
		expect(dynamic.map((asset) => asset.kind)).toEqual([
			"quoteSol",
			"quoteToken",
			"mintBadge",
			"prizePool",
		]);
		expect(() =>
			bundleAssets({
				assetCount: 1,
				kinds: new Uint8Array([11]),
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
	it("commits to PrizePool order and sealed version", async () => {
		const tree = payer;
		const second = address("7RmhTYBS7Uv9PSNmJGX6tM8BjSn7HVbGdVgV6EtCNKLm");
		const item = (asset: Address, nonce: bigint) => ({
			asset,
			metadataMutable: false,
			metadata: bubblegumMetadata(),
			proof: {
				root: new Uint8Array(32),
				dataHash: new Uint8Array(32).fill(Number(nonce) + 1),
				creatorHash: new Uint8Array(32).fill(Number(nonce) + 2),
				nonce,
				leafIndex: Number(nonce),
				tree,
				treeConfig: tree,
				proof: [] as const,
			},
		});
		const ordered = await prizePoolManifestAccumulator(
			payer,
			[item(payer, 0n), item(second, 1n)],
		);
		const reversed = await prizePoolManifestAccumulator(
			payer,
			[item(second, 1n), item(payer, 0n)],
		);
		expect(ordered).not.toEqual(reversed);
		const verifiedFlagsOnly = await prizePoolManifestAccumulator(
			payer,
			[{
				...item(payer, 0n),
				metadata: bubblegumMetadata({
					collectionVerified: true,
					creatorVerified: true,
				}),
			}],
		);
		const unverifiedFlagsOnly = await prizePoolManifestAccumulator(
			payer,
			[item(payer, 0n)],
		);
		expect(verifiedFlagsOnly).toEqual(unverifiedFlagsOnly);
		const changedMetadata = await prizePoolManifestAccumulator(
			payer,
			[{
				...item(payer, 0n),
				metadata: bubblegumMetadata({ uri: "https://example.com/2.json" }),
			}],
		);
		expect(changedMetadata).not.toEqual(unverifiedFlagsOnly);
		await expect(
			prizePoolManifestAccumulator(payer, [{
				...item(payer, 0n),
				metadata: bubblegumMetadata({ mutable: true }),
			}]),
		).rejects.toThrow(/immutable/);
		await expect(
			prizePoolManifestAccumulator(payer, [{
				...item(payer, 0n),
				metadata: new Uint8Array([1]),
			}]),
		).rejects.toThrow(/canonical/);
		const commitment = await prizePoolCommitment({
			pool: payer,
			tree,
			manifestAccumulator: ordered,
			quantity: 2n,
			assetIndex: 0,
			version: 1n,
		});
		expect(
			await prizePoolCommitment({
				pool: payer,
				tree,
				manifestAccumulator: ordered,
				quantity: 2n,
				assetIndex: 0,
				version: 2n,
			}),
		).not.toEqual(commitment);
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
