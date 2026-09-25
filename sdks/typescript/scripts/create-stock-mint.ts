/**
 * Devnet-only: create a Token-2022 mint shaped like a PreStocks pre-IPO
 * stock, for exercising issuer-controlled stock prizes end to end.
 *
 * The mint carries the PreStocks issuer as permanent delegate (a public key
 * only; nobody here holds it), a transfer fee, and on-mint metadata, then
 * mints the whole supply to the payer.
 *
 *   pnpm --dir sdks/typescript create:stock-mint -- \
 *     --keypair ../../target/devnet/payer.json --symbol PREX --name "PreStock X" \
 *     --supply 1000000000 [--decimals 6] [--fee-bps 100] [--max-fee 1000000000]
 *
 * The script refuses to run against anything but devnet.
 */
import { getCreateAccountInstruction } from "@solana-program/system";
import {
	extension,
	findAssociatedTokenPda,
	getCreateAssociatedTokenIdempotentInstruction,
	getInitializeMint2Instruction,
	getMintSize,
	getMintToCheckedInstruction,
	getPostInitializeInstructionsForMintExtensions,
	getPreInitializeInstructionsForMintExtensions,
	TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import {
	address,
	appendTransactionMessageInstructions,
	createSolanaRpc,
	createTransactionMessage,
	generateKeyPairSigner,
	getBase64EncodedWireTransaction,
	pipe,
	setTransactionMessageFeePayerSigner,
	setTransactionMessageLifetimeUsingBlockhash,
	signTransactionMessageWithSigners,
	some,
} from "@solana/kit";
import {
	installPatientFetch,
	loadKeypair,
	parseArgs,
	verifiedRpcUrl,
} from "./cli.js";

/** The PreStocks issuer: permanent delegate of every PreStocks mint. */
const PRESTOCKS_ISSUER = address("WV9PJN7XTmTLVwbutCLFxp8TyePee6Xq5mRq6Fti5Wc");

installPatientFetch();

const args = parseArgs(process.argv.slice(2));
const rpcUrl = await verifiedRpcUrl("devnet", args.optional("rpc"));
const rpc = createSolanaRpc(rpcUrl);
const payer = await loadKeypair(args.required("keypair"));
const symbol = args.required("symbol");
const name = args.required("name");
const decimals = Number(args.optional("decimals") ?? "6");
const supply = BigInt(args.required("supply"));
const feeBps = Number(args.optional("fee-bps") ?? "100");
const maxFee = BigInt(args.optional("max-fee") ?? "18446744073709551615");
const mint = await generateKeyPairSigner();
const { epoch } = await rpc.getEpochInfo().send();
const fee = { epoch, maximumFee: maxFee, transferFeeBasisPoints: feeBps };
const preMint = [
	extension("TransferFeeConfig", {
		transferFeeConfigAuthority: PRESTOCKS_ISSUER,
		withdrawWithheldAuthority: PRESTOCKS_ISSUER,
		withheldAmount: 0n,
		olderTransferFee: fee,
		newerTransferFee: fee,
	}),
	extension("PermanentDelegate", { delegate: PRESTOCKS_ISSUER }),
	extension("MetadataPointer", {
		authority: some(payer.address),
		metadataAddress: some(mint.address),
	}),
];
const metadata = extension("TokenMetadata", {
	updateAuthority: some(payer.address),
	mint: mint.address,
	name,
	symbol,
	uri: "",
	additionalMetadata: new Map(),
});
const space = getMintSize(preMint);
const lamports = await rpc.getMinimumBalanceForRentExemption(
	BigInt(getMintSize([...preMint, metadata])),
).send();
const [payerAta] = await findAssociatedTokenPda({
	owner: payer.address,
	mint: mint.address,
	tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
});
const instructions = [
	getCreateAccountInstruction({
		payer,
		newAccount: mint,
		lamports,
		space,
		programAddress: TOKEN_2022_PROGRAM_ADDRESS,
	}),
	...getPreInitializeInstructionsForMintExtensions(mint.address, preMint),
	getInitializeMint2Instruction({
		mint: mint.address,
		decimals,
		mintAuthority: payer.address,
		// PreStocks mints are freezable by the issuer.
		freezeAuthority: PRESTOCKS_ISSUER,
	}),
	...getPostInitializeInstructionsForMintExtensions(mint.address, payer, [
		metadata,
	]),
	getCreateAssociatedTokenIdempotentInstruction({
		payer,
		ata: payerAta,
		owner: payer.address,
		mint: mint.address,
		tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
	}),
	getMintToCheckedInstruction({
		mint: mint.address,
		token: payerAta,
		mintAuthority: payer,
		amount: supply,
		decimals,
	}, { programAddress: TOKEN_2022_PROGRAM_ADDRESS }),
];
const { value: blockhash } = await rpc.getLatestBlockhash().send();
const transaction = await signTransactionMessageWithSigners(pipe(
	createTransactionMessage({ version: 0 }),
	(message) => setTransactionMessageFeePayerSigner(payer, message),
	(message) => setTransactionMessageLifetimeUsingBlockhash(blockhash, message),
	(message) => appendTransactionMessageInstructions(instructions, message),
));
const signature = await rpc.sendTransaction(
	getBase64EncodedWireTransaction(transaction),
	{ encoding: "base64", preflightCommitment: "confirmed" },
).send();

console.log(`${symbol} mint ${mint.address}`);
console.log(`  ${supply} base units (${decimals} decimals) → ${payerAta}`);
console.log(`  fee ${feeBps} bps, permanent delegate ${PRESTOCKS_ISSUER}`);
console.log(`  signature ${signature}`);
