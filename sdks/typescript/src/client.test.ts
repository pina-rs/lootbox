import {
	getResultReceiptStateEncoder,
	getTemplateOpeningStateDecoder,
	getTemplateOpeningStateEncoder,
	getTemplateStateDecoder,
	getTemplateStateEncoder,
	MAX_BUBBLEGUM_PROOF_ACCOUNTS,
	REQUEST_TEMPLATE_OPEN_DISCRIMINATOR,
	withBubblegumProofAccounts,
} from "@pina-rs/lootbox-program-client";
import {
	type AccountMeta,
	AccountRole,
	type Address,
	address,
	blockhash,
	createNoopSigner,
	decompileTransactionMessage,
	generateKeyPairSigner,
	getAddressDecoder,
	getAddressEncoder,
	getBase64Decoder,
	getBase64Encoder,
	getCompiledTransactionMessageDecoder,
	getProgramDerivedAddress,
	getTransactionDecoder,
	getU64Encoder,
	type Instruction,
	type InstructionWithAccounts,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import { computeUnitLimitByNames } from "./budget.js";
import {
	accountFundingRentCeiling,
	assertFundedPrizeMatches,
	base58Bytes,
	boundedRejectionTarget,
	BUBBLEGUM_PROGRAM,
	bundleAssets,
	composeWinnerRoutedSolQuoteClaim,
	composeWinnerRoutedTokenQuoteClaim,
	LootboxClient,
	type LootboxRpc,
	partitionPrizeDeliveryInstructions,
	prizePoolCommitment,
	prizePoolManifestAccumulator,
	readU64,
	rentExemptionLamports,
	validateCompressedNftIdentity,
} from "./client.js";

const payer = address("LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E");

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
		const mint = address("LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E");
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
		expect(
			bundleAssets({
				assetCount: 1,
				kinds: new Uint8Array([11]),
				mints: new Uint8Array(128),
				amounts: new Uint8Array(32),
				decimals: new Uint8Array(4),
			})[0]?.kind,
		).toBe("exclusiveNft");
		expect(() =>
			bundleAssets({
				assetCount: 1,
				kinds: new Uint8Array([12]),
				mints: new Uint8Array(128),
				amounts: new Uint8Array(32),
				decimals: new Uint8Array(4),
			})
		).toThrow(/invalid prize/);
	});
	it("requires the bound winner to sign an appended quote route", () => {
		const program = address(
			"LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E",
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
			"LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E",
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

const PROGRAM_ADDRESS = address("LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E");
const COMPUTE_BUDGET_ADDRESS = address(
	"ComputeBudget111111111111111111111111111111",
);
const LOOKUP_TABLE_ADDRESS = address(
	"SysvarC1ock11111111111111111111111111111111",
);
const LOOKUP_TABLE_MEMBER = address("11111111111111111111111111111111");
const SENDER = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");

/** The RPC reads `send` performs, captured for one submission. */
function sendRpc() {
	const sent: string[] = [];

	const rpc = {
		getLatestBlockhash: () => ({
			send: async () => ({
				value: {
					blockhash: blockhash("GHjnZdpDPTpex7X8WqMf9NdawoM4kXQ8JUkvdLdDebeR"),
					lastValidBlockHeight: 100n,
				},
			}),
		}),
		getMultipleAccounts: (keys: readonly Address[]) => ({
			send: async () => ({
				value: keys.map(() => ({
					data: {
						parsed: { info: { addresses: [LOOKUP_TABLE_MEMBER] } },
						source: "rpc",
					},
					executable: false,
					lamports: 0,
					owner: LOOKUP_TABLE_MEMBER,
					rentEpoch: 0,
					space: 0,
				})),
			}),
		}),
		sendTransaction: (wire: string) => ({
			send: async () => {
				sent.push(wire);

				return "SIGNATURE1";
			},
		}),
		getSignatureStatuses: () => ({
			send: async () => ({
				value: [
					{ confirmationStatus: "confirmed", err: null, slot: 1n },
				],
			}),
		}),
	} as unknown as LootboxRpc;

	return { rpc, sent };
}

/** Decode the single transaction a captured send produced. */
function decodeSent(wire: string) {
	const transaction = getTransactionDecoder().decode(
		getBase64Encoder().encode(wire),
	);
	const compiled = getCompiledTransactionMessageDecoder().decode(
		transaction.messageBytes,
	);

	return {
		compiled,
		message: decompileTransactionMessage(compiled, {
			addressesByLookupTableAddress: {
				[LOOKUP_TABLE_ADDRESS]: [LOOKUP_TABLE_MEMBER],
			},
		}),
	};
}

describe("LootboxClient transaction costs", () => {
	it("memoizes rent exemption per account size", async () => {
		const reads: bigint[] = [];
		const rpc = {
			getMinimumBalanceForRentExemption: (space: bigint) => ({
				send: async () => {
					reads.push(space);

					return accountFundingRentCeiling(space);
				},
			}),
		} as unknown as LootboxRpc;
		const cache = new Map<number, bigint>();

		await rentExemptionLamports(rpc, 82n, cache);
		await rentExemptionLamports(rpc, 82, cache);
		await rentExemptionLamports(rpc, 165n, cache);

		expect(reads).toEqual([82n, 165n]);
	});

	it("encodes memcmp filters as base58", () => {
		expect(base58Bytes(new Uint8Array(32))).toBe("1".repeat(32));
	});

	it("caches lookup table contents per cache lifetime", async () => {
		let fetches = 0;
		const rpc = {
			getMultipleAccounts: (keys: readonly Address[]) => ({
				send: async () => {
					fetches += 1;

					return {
						value: keys.map(() => ({
							data: {
								parsed: { info: { addresses: [LOOKUP_TABLE_MEMBER] } },
								source: "rpc",
							},
							executable: false,
							lamports: 0,
							owner: LOOKUP_TABLE_MEMBER,
							rentEpoch: 0,
							space: 0,
						})),
					};
				},
			}),
		} as unknown as LootboxRpc;
		const client = new LootboxClient(
			"http://localhost:8899",
			await generateKeyPairSigner(),
			undefined,
			{
				lookupTableAddresses: [LOOKUP_TABLE_ADDRESS],
				lookupTableCacheMilliseconds: 3_600_000,
				rpc,
			},
		);
		const first = await client.lookupTables();
		const second = await client.lookupTables();

		expect(first).toEqual({ [LOOKUP_TABLE_ADDRESS]: [LOOKUP_TABLE_MEMBER] });
		expect(second).toBe(first);
		expect(fetches).toBe(1);
	});

	it("sends with the measured compute budget and lookup compression", async () => {
		const { rpc, sent } = sendRpc();
		const client = new LootboxClient(
			"http://localhost:8899",
			await generateKeyPairSigner(),
			undefined,
			{ lookupTableAddresses: [LOOKUP_TABLE_ADDRESS], rpc },
		);
		const instruction: Instruction = {
			accounts: [
				{ address: LOOKUP_TABLE_MEMBER, role: AccountRole.READONLY },
			],
			data: new Uint8Array([REQUEST_TEMPLATE_OPEN_DISCRIMINATOR, 0]),
			programAddress: PROGRAM_ADDRESS,
		};
		const signature = await client.send([instruction], "request open");

		expect(signature).toBe("SIGNATURE1");
		expect(sent).toHaveLength(1);

		const { compiled, message } = decodeSent(sent[0] ?? "");
		const budget = message.instructions.find(
			(instruction) => instruction.programAddress === COMPUTE_BUDGET_ADDRESS,
		);

		expect(budget?.data).toEqual(
			new Uint8Array([
				2,
				...new Uint8Array(
					new Uint32Array([
						computeUnitLimitByNames(["requestTemplateOpen"]) ?? 0,
					])
						.buffer,
				),
			]),
		);
		expect(
			compiled.version === 0
				? compiled.addressTableLookups?.map(
					(lookup) => lookup.lookupTableAddress,
				)
				: undefined,
		).toEqual([LOOKUP_TABLE_ADDRESS]);
		expect(compiled.staticAccounts).not.toContain(LOOKUP_TABLE_MEMBER);
	});

	it("honors explicit compute unit and priority fee overrides", async () => {
		const first = sendRpc();
		const explicit = new LootboxClient(
			"http://localhost:8899",
			await generateKeyPairSigner(),
			undefined,
			{ rpc: first.rpc },
		);
		const instruction: Instruction = {
			accounts: [],
			data: new Uint8Array([REQUEST_TEMPLATE_OPEN_DISCRIMINATOR, 0]),
			programAddress: PROGRAM_ADDRESS,
		};

		await explicit.send([instruction], "request open", {
			computeUnitLimit: 12345,
			priorityFeeMicroLamports: 1000n,
		});

		const firstMessage = decodeSent(first.sent[0] ?? "").message;
		const firstBudget = firstMessage.instructions.find(
			(instruction) => instruction.programAddress === COMPUTE_BUDGET_ADDRESS,
		);
		const firstPrice = firstMessage.instructions.find(
			(instruction) =>
				instruction.programAddress === COMPUTE_BUDGET_ADDRESS &&
				instruction.data?.[0] === 3,
		);

		expect(firstBudget?.data).toEqual(
			new Uint8Array([2, ...new Uint8Array(new Uint32Array([12345]).buffer)]),
		);
		expect(firstPrice?.data?.slice(1)).toEqual(
			new Uint8Array(new BigUint64Array([1000n]).buffer),
		);

		const second = sendRpc();
		const none = new LootboxClient(
			"http://localhost:8899",
			await generateKeyPairSigner(),
			undefined,
			{ rpc: second.rpc },
		);

		await none.send([instruction], "request open", {
			computeUnitLimit: "none",
		});

		const secondMessage = decodeSent(second.sent[0] ?? "").message;

		expect(secondMessage.instructions).toHaveLength(1);
		expect(secondMessage.instructions[0]?.programAddress).toBe(PROGRAM_ADDRESS);
	});

	it("inventories with discriminator filters per account type", async () => {
		const queries: { filters: unknown[] }[] = [];
		const templateData = getBase64Decoder().decode(
			getTemplateStateEncoder().encode({
				authority: SENDER,
				boxMint: LOOKUP_TABLE_MEMBER,
				oracleProgram: LOOKUP_TABLE_MEMBER,
				oracleQueue: LOOKUP_TABLE_MEMBER,
				id: 1n,
				opensAt: 0n,
				lockedAt: 0n,
				totalBundles: 0n,
				totalMinted: 0n,
				remainingBundles: 0n,
				pendingOpenings: 0n,
				nextRequest: 0n,
				nextAllocation: 0n,
				revision: 0n,
				manifestAccumulator: new Uint8Array(32),
				manifestHash: new Uint8Array(32),
				settlementBountyLamports: 0n,
				resultReceiptRentLamports: 0n,
				remainingResultReceipts: 0n,
				remainingSettlementBounties: 0n,
				name: new Uint8Array(32),
				uri: new Uint8Array(200),
				bundleCount: 0,
				status: 0,
				resultReceiptsEnabled: false,
				bump: 254,
				serviceVaultBump: 253,
				remaining: [],
			}),
		);
		const openingData = getBase64Decoder().decode(
			getTemplateOpeningStateEncoder().encode({
				template: LOOKUP_TABLE_MEMBER,
				boxAuthority: SENDER,
				beneficiary: SENDER,
				rentRefund: SENDER,
				consumerProgram: LOOKUP_TABLE_MEMBER,
				consumerContext: new Uint8Array(32),
				randomness: LOOKUP_TABLE_MEMBER,
				sequence: 1n,
				seedSlot: 2n,
				entropy: new Uint8Array(32),
				treasuryRevision: 0n,
				eligibleBundleCount: 1,
				status: 0,
				selectedBundle: 0,
				selectedPoolItem: 0,
				selectedPoolAsset: 0,
				hasPoolAssignment: false,
				claimedMask: 0,
				bump: 254,
			}),
		);
		let call = 0;
		const rpc = {
			getProgramAccounts: (
				_program: Address,
				config: { filters: unknown[] },
			) => ({
				send: async () => {
					queries.push({ filters: config.filters });

					// The template query is issued first; the opening query second.
					call += 1;

					return [
						{
							account: { data: [call === 1 ? templateData : openingData] },
							pubkey: LOOKUP_TABLE_MEMBER,
						},
					];
				},
			}),
		} as unknown as LootboxRpc;
		const client = new LootboxClient(
			"http://localhost:8899",
			await generateKeyPairSigner(),
			undefined,
			{ rpc },
		);
		const inventory = await client.inventory();

		expect(queries).toHaveLength(2);
		expect(queries[0]?.filters).toHaveLength(1);
		expect(queries[1]?.filters).toHaveLength(1);
		expect(inventory.templates).toHaveLength(1);
		expect(inventory.templates[0]?.data.id).toBe(1n);
		expect(inventory.openings).toHaveLength(1);
		expect(inventory.openings[0]?.data.sequence).toBe(1n);
	});

	it("quotes service funding from memoized rent reads", async () => {
		const reads: bigint[] = [];
		const rpc = {
			getMinimumBalanceForRentExemption: (space: bigint) => ({
				send: async () => {
					reads.push(space);

					return accountFundingRentCeiling(space);
				},
			}),
		} as unknown as LootboxRpc;
		const client = new LootboxClient(
			"http://localhost:8899",
			await generateKeyPairSigner(),
			undefined,
			{ rpc },
		);
		const data = getTemplateStateEncoder().encode({
			authority: SENDER,
			boxMint: LOOKUP_TABLE_MEMBER,
			oracleProgram: LOOKUP_TABLE_MEMBER,
			oracleQueue: LOOKUP_TABLE_MEMBER,
			id: 1n,
			opensAt: 0n,
			lockedAt: 0n,
			totalBundles: 3n,
			totalMinted: 0n,
			remainingBundles: 3n,
			pendingOpenings: 0n,
			nextRequest: 0n,
			nextAllocation: 0n,
			revision: 0n,
			manifestAccumulator: new Uint8Array(32),
			manifestHash: new Uint8Array(32),
			settlementBountyLamports: 5_000n,
			resultReceiptRentLamports: 0n,
			remainingResultReceipts: 3n,
			remainingSettlementBounties: 3n,
			name: new Uint8Array(32),
			uri: new Uint8Array(200),
			bundleCount: 0,
			status: 0,
			resultReceiptsEnabled: true,
			bump: 254,
			serviceVaultBump: 253,
			remaining: [],
		});
		const quote = await client.serviceFundingQuote({
			address: LOOKUP_TABLE_MEMBER,
			data: getTemplateStateDecoder().decode(data),
		});

		expect(reads).toEqual([
			BigInt(getResultReceiptStateEncoder().fixedSize),
			0n,
		]);
		expect(quote.resultReceiptRent).toBe(
			accountFundingRentCeiling(getResultReceiptStateEncoder().fixedSize),
		);
		expect(quote.serviceVaultRent).toBe(890_880n);
	});
});
