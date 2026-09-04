import * as generated from "@pina-rs/lootbox-generated";
import { getCreateAccountInstruction } from "@solana-program/system";
import * as token from "@solana-program/token-2022";
import {
	type Address,
	address,
	appendTransactionMessageInstructions,
	createSolanaRpc,
	createTransactionMessage,
	generateKeyPairSigner,
	getAddressDecoder,
	getAddressEncoder,
	getBase64EncodedWireTransaction,
	getBase64Encoder,
	getProgramDerivedAddress,
	getU64Encoder,
	type Instruction,
	pipe,
	type ReadonlyUint8Array,
	setTransactionMessageFeePayerSigner,
	setTransactionMessageLifetimeUsingBlockhash,
	signTransactionMessageWithSigners,
	type TransactionSigner,
} from "@solana/kit";
import {
	createTemplatePlan,
	encodeTemplateText,
	templateInventory,
	type TemplatePlan,
} from "./templates.js";

export const CLASSIC_TOKEN_PROGRAM = address(
	"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
export const BOX_TOKEN_PROGRAM = token.TOKEN_2022_PROGRAM_ADDRESS;
const SLOT_HASHES = address("SysvarS1otHashes111111111111111111111111111");
const WRAPPED_SOL = address("So11111111111111111111111111111111111111112");
const LOOKUP_TABLE = address("AddressLookupTab1e1111111111111111111111111");
const utf8 = new TextEncoder();
const addressBytes = getAddressEncoder();
const commitment = "processed" as const;

export type ChainTemplate = Readonly<
	{ address: Address; data: generated.TemplateState }
>;
export type ChainOpening = Readonly<
	{ address: Address; data: generated.TemplateOpeningState }
>;
export type ChainBundle = Readonly<
	{ address: Address; data: generated.BundleState }
>;
export type OracleAccounts = Readonly<{
	queue: Address;
	oracle: Address;
	rewardEscrow: Address;
	programState: Address;
	lutSigner: Address;
	lut: Address;
	stats: Address;
}>;
export type OracleProof = Readonly<
	{
		signature: ReadonlyUint8Array;
		recoveryId: number;
		value: ReadonlyUint8Array;
	}
>;
export type ClientProgress = (message: string, signature?: string) => void;

export function readU64(bytes: ReadonlyUint8Array, index: number): bigint {
	return new DataView(Uint8Array.from(bytes).buffer).getBigUint64(
		index * 8,
		true,
	);
}

export function bundleAssets(
	bundle: Pick<
		generated.BundleState,
		"assetCount" | "kinds" | "mints" | "amounts" | "decimals"
	>,
) {
	if (
		bundle.assetCount < 1 || bundle.assetCount > 4 ||
		Array.from(bundle.kinds.slice(0, bundle.assetCount)).some((kind) =>
			kind > 2
		)
	) throw new Error("invalid prize asset kind or count");
	return Array.from({ length: bundle.assetCount }, (_, index) => ({
		index,
		kind: bundle.kinds[index] === 0
			? "sol" as const
			: bundle.kinds[index] === 2
			? "nft" as const
			: "token" as const,
		mint: getAddressDecoder().decode(
			bundle.mints.slice(index * 32, (index + 1) * 32),
		),
		amount: readU64(bundle.amounts, index),
		decimals: bundle.decimals[index] ?? 0,
	}));
}

/** Mirrors the program's domain-separated, bounded rejection sampler. */
export async function selectTemplateBundle(
	template: ChainTemplate,
	opening: ChainOpening,
): Promise<number> {
	const inventory = templateInventory(template.data);
	const total = inventory.reduce(
		(sum, item) => sum + item.weight * item.remaining,
		0n,
	);
	if (total <= 0n || total > 0xffff_ffffn) {
		throw new RangeError("invalid live inventory weight");
	}
	const threshold = (1n << 64n) % total;
	let candidate = 0n;
	for (let counter = 0; counter < 8; counter++) {
		const bytes = Uint8Array.from([
			...utf8.encode("pina-lootbox-outcome-v1"),
			...opening.data.entropy,
			...addressBytes.encode(template.address),
			...addressBytes.encode(opening.address),
			counter,
		]);
		candidate = new DataView(await crypto.subtle.digest("SHA-256", bytes))
			.getBigUint64(0, true);
		if (candidate >= threshold) break;
	}
	const target = candidate % total;
	let cumulative = 0n;
	for (const item of inventory) {
		cumulative += item.weight * item.remaining;
		if (target < cumulative) return item.index;
	}
	throw new Error("no outcome for sampled target");
}

/** Transaction orchestration over the generated ABI. The caller owns signing,
 * oracle transport, persistence, and cluster selection. No wallet secrets leave
 * the signer. A timeout never causes an automatic duplicate submission.
 */
export class LootboxClient {
	readonly rpc: ReturnType<typeof createSolanaRpc>;
	constructor(
		rpcUrl: string,
		readonly payer: TransactionSigner,
		readonly progress: ClientProgress = () => {},
	) {
		this.rpc = createSolanaRpc(rpcUrl);
	}

	async send(
		instructions: readonly Instruction[],
		label: string,
	): Promise<string> {
		this.progress(label);
		const { value: blockhash } = await this.rpc.getLatestBlockhash({
			commitment,
		}).send();
		const message = pipe(
			createTransactionMessage({ version: 0 }),
			(message) => setTransactionMessageFeePayerSigner(this.payer, message),
			(message) =>
				setTransactionMessageLifetimeUsingBlockhash(blockhash, message),
			(message) => appendTransactionMessageInstructions(instructions, message),
		);
		const transaction = await signTransactionMessageWithSigners(message);
		const signature = await this.rpc.sendTransaction(
			getBase64EncodedWireTransaction(transaction),
			{
				encoding: "base64",
				preflightCommitment: commitment,
			},
		).send();
		for (let attempt = 0; attempt < 80; attempt++) {
			const { value } = await this.rpc.getSignatureStatuses([signature]).send();
			const status = value[0];
			if (status?.err) {
				throw new Error(
					`Transaction ${signature} failed: ${JSON.stringify(status.err)}`,
				);
			}
			if (status) {
				this.progress(label, signature);
				return signature;
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		throw new Error(
			`Confirmation timed out. Refresh chain state before retrying. Signature: ${signature}`,
		);
	}

	async templateAddress(id: bigint) {
		return getProgramDerivedAddress({
			programAddress: generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
			seeds: [
				utf8.encode("template"),
				addressBytes.encode(this.payer.address),
				getU64Encoder().encode(id),
			],
		});
	}
	async bundleAddress(template: Address, index: number) {
		return getProgramDerivedAddress({
			programAddress: generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
			seeds: [
				utf8.encode("bundle"),
				addressBytes.encode(template),
				new Uint8Array([index]),
			],
		});
	}
	async ata(
		owner: Address,
		mint: Address,
		tokenProgram: Address = BOX_TOKEN_PROGRAM,
	) {
		return (await token.findAssociatedTokenPda({ owner, mint, tokenProgram }))[
			0
		];
	}
	async createAta(
		owner: Address,
		mint: Address,
		tokenProgram: Address = BOX_TOKEN_PROGRAM,
	) {
		return token.getCreateAssociatedTokenIdempotentInstruction({
			payer: this.payer,
			ata: await this.ata(owner, mint, tokenProgram),
			owner,
			mint,
			tokenProgram,
		});
	}
	async template(template: Address): Promise<ChainTemplate> {
		return generated.fetchTemplateState(this.rpc, template, { commitment });
	}
	async bundles(template: ChainTemplate): Promise<ChainBundle[]> {
		return Promise.all(
			Array.from(
				{ length: template.data.outcomeCount },
				async (_, index) =>
					generated.fetchBundleState(
						this.rpc,
						(await this.bundleAddress(template.address, index))[0],
						{ commitment },
					),
			),
		);
	}
	async inventory() {
		const accounts = await this.rpc.getProgramAccounts(
			generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
			{ encoding: "base64", commitment },
		).send();
		const templates: ChainTemplate[] = [];
		const openings: ChainOpening[] = [];
		for (const account of accounts) {
			const bytes = getBase64Encoder().encode(account.account.data[0]);
			if (bytes[0] === 4) {
				templates.push({
					address: account.pubkey,
					data: generated.getTemplateStateDecoder().decode(bytes),
				});
			}
			if (bytes[0] === 6) {
				openings.push({
					address: account.pubkey,
					data: generated.getTemplateOpeningStateDecoder().decode(bytes),
				});
			}
		}
		return { templates, openings };
	}
	async boxBalance(owner: Address, mint: Address): Promise<bigint> {
		const ata = await this.ata(owner, mint);
		const { value } = await this.rpc.getAccountInfo(ata, {
			encoding: "base64",
			commitment,
		}).send();
		if (!value) return 0n;
		if (value.owner !== BOX_TOKEN_PROGRAM) {
			throw new Error("unexpected token account owner");
		}
		return token.getTokenDecoder().decode(
			getBase64Encoder().encode(value.data[0]),
		).amount;
	}

	/** A stable id and mint signer allow re-entry after interrupted creation.
	 * Completed funding steps are read from chain, never repeated blindly.
	 */
	async createTemplate(
		plan: TemplatePlan,
		id: bigint,
		mint: TransactionSigner,
		oracleProgram: Address,
		queue: Address,
	) {
		plan = createTemplatePlan(plan);
		const [template, bump] = await this.templateAddress(id);
		const authority = this.payer.address;
		const exists = await this.rpc.getAccountInfo(mint.address, {
			encoding: "base64",
			commitment,
		}).send();
		if (!exists.value) {
			// 234 = base mint + account type/padding + MetadataPointer TLV.
			// TokenMetadata grows the allocation; prepay its exact encoded size.
			const finalSize = 234 + 4 + 64 + 16 + utf8.encode(plan.name).length + 4 +
				utf8.encode(plan.uri).length;
			const rent = await this.rpc.getMinimumBalanceForRentExemption(
				BigInt(finalSize),
			).send();
			await this.send([
				getCreateAccountInstruction({
					payer: this.payer,
					newAccount: mint,
					lamports: rent,
					space: 234n,
					programAddress: BOX_TOKEN_PROGRAM,
				}),
				token.getInitializeMetadataPointerInstruction({
					mint: mint.address,
					authority: null,
					metadataAddress: mint.address,
				}),
				token.getInitializeMint2Instruction({
					mint: mint.address,
					decimals: 0,
					mintAuthority: authority,
					freezeAuthority: null,
				}),
				token.getInitializeTokenMetadataInstruction({
					metadata: mint.address,
					updateAuthority: authority,
					mint: mint.address,
					mintAuthority: this.payer,
					name: plan.name,
					symbol: "LOOT",
					uri: plan.uri,
				}),
				token.getUpdateTokenMetadataUpdateAuthorityInstruction({
					metadata: mint.address,
					updateAuthority: this.payer,
					newUpdateAuthority: null,
				}),
				token.getSetAuthorityInstruction({
					owned: mint.address,
					owner: this.payer,
					authorityType: token.AuthorityType.MintTokens,
					newAuthority: template,
				}),
			], "Create immutable box mint");
		}
		const account = await generated.fetchMaybeTemplateState(
			this.rpc,
			template,
			{ commitment },
		);
		if (!account.exists) {
			await this.send([generated.getCreateTemplateInstruction({
				authority: this.payer,
				template,
				boxMint: mint.address,
				id,
				maxSupply: plan.maxSupply,
				opensAt: plan.opensAt,
				oracleProgram,
				oracleQueue: queue,
				name: encodeTemplateText(plan.name, 32),
				uri: encodeTemplateText(plan.uri, 200),
				bump,
			})], "Create treasury template");
		}
		const state = await this.template(template);
		if (
			state.data.boxMint !== mint.address ||
			state.data.maxSupply !== plan.maxSupply ||
			state.data.opensAt !== plan.opensAt ||
			state.data.oracleProgram !== oracleProgram ||
			state.data.oracleQueue !== queue ||
			state.data.outcomeCount > plan.bundles.length ||
			Array.from(state.data.name).join() !==
				Array.from(encodeTemplateText(plan.name, 32)).join() ||
			Array.from(state.data.uri).join() !==
				Array.from(encodeTemplateText(plan.uri, 200)).join()
		) throw new Error("saved draft does not match the on-chain template");
		if (state.data.retired) throw new Error("template is retired");
		for (const [index, prize] of plan.bundles.entries()) {
			if (
				index < state.data.outcomeCount &&
				readU64(state.data.weights, index) !== prize.weight
			) throw new Error("saved prize weight differs from chain");
			const [bundle, bundleBump] = await this.bundleAddress(template, index);
			if (index >= state.data.outcomeCount) {
				await this.send([generated.getAddBundleInstruction({
					authority,
					template,
					bundle,
					quantity: prize.quantity,
					weight: prize.weight,
					assetCount: prize.assets.length,
					bump: bundleBump,
				})], `Add prize bundle ${index + 1}`);
			}
			const funded = await generated.fetchBundleState(this.rpc, bundle, {
				commitment,
			});
			if (
				funded.data.quantity !== prize.quantity ||
				funded.data.assetCount !== prize.assets.length
			) throw new Error("saved bundle differs from chain");
			for (const [assetIndex, asset] of prize.assets.entries()) {
				if (assetIndex < funded.data.fundedAssets) {
					const existing = bundleAssets(funded.data)[assetIndex];
					const amount = asset.kind === "sol"
						? asset.lamports
						: asset.kind === "nft"
						? 1n
						: asset.amount;
					if (
						!existing || existing.kind !== asset.kind ||
						existing.amount !== amount ||
						(asset.kind !== "sol" && existing.mint !== asset.mint)
					) throw new Error("saved prize differs from already funded asset");
					continue;
				}
				if (asset.kind === "sol") {
					await this.send([
						generated.getFundSolPrizeInstruction({
							authority,
							template,
							bundle,
							lamportsPerWin: asset.lamports,
						}),
					], `Escrow SOL · bundle ${index + 1}`);
					continue;
				}
				await this.send([
					await this.createAta(bundle, asset.mint, CLASSIC_TOKEN_PROGRAM),
					generated.getFundTokenPrizeInstruction({
						authority,
						template,
						bundle,
						mint: asset.mint,
						source: await this.ata(
							authority,
							asset.mint,
							CLASSIC_TOKEN_PROGRAM,
						),
						escrow: await this.ata(bundle, asset.mint, CLASSIC_TOKEN_PROGRAM),
						amountPerWin: asset.kind === "nft" ? 1n : asset.amount,
						isNft: asset.kind === "nft",
					}),
				], `Escrow ${asset.kind} · bundle ${index + 1}`);
			}
		}
		if (state.data.sealed) return state;
		await this.send([
			generated.getSealTemplateInstruction({ authority, template }),
		], "Seal funded template");
		return this.template(template);
	}

	async mint(template: ChainTemplate, recipient: Address, amount: bigint) {
		return this.send([
			await this.createAta(recipient, template.data.boxMint),
			generated.getMintTemplateBoxesInstruction({
				authority: this.payer.address,
				template: template.address,
				boxMint: template.data.boxMint,
				recipientBoxAccount: await this.ata(recipient, template.data.boxMint),
				amount,
			}),
		], "Mint gift to recipient");
	}
	/** Create a fixed-supply classic token, including a basic one-of-one NFT.
	 * Existing mints are validated so a saved creation workflow can resume.
	 */
	async createFixedSupplyMint(
		mint: TransactionSigner,
		amount: bigint,
		decimals = 0,
	) {
		const existing = await this.rpc.getAccountInfo(mint.address, {
			encoding: "base64",
			commitment,
		}).send();
		if (existing.value) {
			if (existing.value.owner !== CLASSIC_TOKEN_PROGRAM) {
				throw new Error("reward mint has unexpected owner");
			}
			const data = token.getMintDecoder().decode(
				getBase64Encoder().encode(existing.value.data[0]),
			);
			if (
				data.supply !== amount || data.decimals !== decimals ||
				data.mintAuthority.__option !== "None" ||
				data.freezeAuthority.__option !== "None"
			) throw new Error("reward mint differs from saved draft");
			return mint.address;
		}
		const program = { programAddress: CLASSIC_TOKEN_PROGRAM };
		await this.send([
			getCreateAccountInstruction({
				payer: this.payer,
				newAccount: mint,
				lamports: await this.rpc.getMinimumBalanceForRentExemption(82n).send(),
				space: 82n,
				programAddress: CLASSIC_TOKEN_PROGRAM,
			}),
			token.getInitializeMint2Instruction({
				mint: mint.address,
				decimals,
				mintAuthority: this.payer.address,
				freezeAuthority: null,
			}, program),
			await this.createAta(
				this.payer.address,
				mint.address,
				CLASSIC_TOKEN_PROGRAM,
			),
			token.getMintToInstruction({
				mint: mint.address,
				token: await this.ata(
					this.payer.address,
					mint.address,
					CLASSIC_TOKEN_PROGRAM,
				),
				mintAuthority: this.payer,
				amount,
			}, program),
			token.getSetAuthorityInstruction({
				owned: mint.address,
				owner: this.payer,
				authorityType: token.AuthorityType.MintTokens,
				newAuthority: null,
			}, program),
		], "Create fixed-supply test prize");
		return mint.address;
	}
	async transfer(template: ChainTemplate, recipient: Address, amount: bigint) {
		return this.send([
			await this.createAta(recipient, template.data.boxMint),
			token.getTransferCheckedInstruction({
				source: await this.ata(this.payer.address, template.data.boxMint),
				mint: template.data.boxMint,
				destination: await this.ata(recipient, template.data.boxMint),
				authority: this.payer,
				amount,
				decimals: 0,
			}),
		], "Transfer sealed gift");
	}
	async requestOpen(template: ChainTemplate, oracle: OracleAccounts) {
		const randomness = await generateKeyPairSigner();
		const [opening, bump] = await getProgramDerivedAddress({
			programAddress: generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
			seeds: [
				utf8.encode("template-opening"),
				addressBytes.encode(template.address),
				addressBytes.encode(randomness.address),
			],
		});
		await this.send([generated.getRequestTemplateOpenInstruction({
			owner: this.payer,
			template: template.address,
			boxMint: template.data.boxMint,
			ownerBoxAccount: await this.ata(
				this.payer.address,
				template.data.boxMint,
			),
			opening,
			randomness,
			rewardEscrow: oracle.rewardEscrow,
			oracleQueue: template.data.oracleQueue,
			oracle: oracle.oracle,
			recentSlotHashes: SLOT_HASHES,
			oracleProgram: template.data.oracleProgram,
			oracleProgramState: oracle.programState,
			oracleLutSigner: oracle.lutSigner,
			oracleLut: oracle.lut,
			wrappedSolMint: WRAPPED_SOL,
			addressLookupTableProgram: LOOKUP_TABLE,
			recentSlot: await this.rpc.getSlot({ commitment }).send(),
			bump,
		})], "Burn box & commit randomness");
		return generated.fetchTemplateOpeningState(this.rpc, opening, {
			commitment,
		});
	}
	async fulfill(
		template: ChainTemplate,
		opening: ChainOpening,
		oracle: OracleAccounts,
		proof: OracleProof,
	) {
		return this.send([generated.getFulfillTemplateOpenInstruction({
			payer: this.payer,
			template: template.address,
			opening: opening.address,
			randomness: opening.data.randomness,
			oracleQueue: template.data.oracleQueue,
			oracle: oracle.oracle,
			oracleStats: oracle.stats,
			recentSlotHashes: SLOT_HASHES,
			oracleProgram: template.data.oracleProgram,
			rewardEscrow: oracle.rewardEscrow,
			oracleProgramState: oracle.programState,
			wrappedSolMint: WRAPPED_SOL,
			...proof,
		})], "Verify randomness proof");
	}
	async allocate(template: ChainTemplate, opening: ChainOpening) {
		const index = await selectTemplateBundle(template, opening);
		return this.send([
			generated.getAllocateTemplateOpenInstruction({
				template: template.address,
				opening: opening.address,
				bundle: (await this.bundleAddress(template.address, index))[0],
			}),
		], "Record prize allocation");
	}
	async claim(openingAddress: Address) {
		const opening = await generated.fetchTemplateOpeningState(
			this.rpc,
			openingAddress,
			{ commitment },
		);
		if (opening.data.status === 3) return;
		if (opening.data.status !== 2) {
			throw new Error("opening is not allocated yet");
		}
		const template = opening.data.template;
		const bundle =
			(await this.bundleAddress(template, opening.data.selectedOutcome))[0];
		const data = await generated.fetchBundleState(this.rpc, bundle, {
			commitment,
		});
		for (const asset of bundleAssets(data.data)) {
			if ((opening.data.claimedMask & (1 << asset.index)) !== 0) continue;
			const input = {
				template,
				opening: openingAddress,
				bundle,
				recipient: opening.data.recipient,
				assetIndex: asset.index,
			};
			const instructions = asset.kind === "sol"
				? [generated.getClaimSolPrizeInstruction(input)]
				: [
					await this.createAta(
						input.recipient,
						asset.mint,
						CLASSIC_TOKEN_PROGRAM,
					),
					generated.getClaimTokenPrizeInstruction({
						...input,
						mint: asset.mint,
						escrow: await this.ata(bundle, asset.mint, CLASSIC_TOKEN_PROGRAM),
						destination: await this.ata(
							input.recipient,
							asset.mint,
							CLASSIC_TOKEN_PROGRAM,
						),
					}),
				];
			await this.send(instructions, `Deliver prize asset ${asset.index + 1}`);
		}
	}
}
