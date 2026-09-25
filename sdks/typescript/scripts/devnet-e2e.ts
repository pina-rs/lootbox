/**
 * Devnet end-to-end run against real Switchboard On-Demand randomness.
 *
 * Creates a small SOL + SPL treasury, locks it with a reveal date a couple of
 * minutes ahead, opens one box, fetches the live oracle's reveal proof,
 * settles, claims, and closes the receipt. Every transaction's fee and the
 * payer's lamport delta are printed as a cost table, which doubles as the
 * per-open cost measurement.
 *
 * Usage (from the repository root):
 *
 *   LOOTBOX_DEVNET_KEYPAIR=target/devnet/payer.json \
 *     pnpm --dir sdks/typescript e2e:devnet
 *
 * Optional: LOOTBOX_DEVNET_RPC_URL (default https://api.devnet.solana.com),
 * LOOTBOX_REVEAL_DELAY_SECONDS (default 120).
 *
 * The script refuses to run against any cluster whose genesis hash is not
 * devnet's, so a mainnet RPC URL can never spend real funds.
 */
import {
	type Address,
	createKeyPairSignerFromBytes,
	createSolanaRpc,
	generateKeyPairSigner,
	type Signature,
} from "@solana/kit";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	CLASSIC_TOKEN_PROGRAM,
	createSwitchboardOracle,
	createTemplatePlan,
	fetchTemplateOpeningState,
	LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
	LootboxClient,
	SWITCHBOARD_PROGRAM,
} from "../src/index.js";

const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const LAMPORTS_PER_SOL = 1_000_000_000n;

type Step = Readonly<{
	phase: "setup" | "open";
	label: string;
	signature: Signature;
	fee: bigint;
	payerDelta: bigint;
}>;

const keypairPath = process.env.LOOTBOX_DEVNET_KEYPAIR;
const rpcUrl = process.env.LOOTBOX_DEVNET_RPC_URL ??
	"https://api.devnet.solana.com";
const revealDelay = BigInt(process.env.LOOTBOX_REVEAL_DELAY_SECONDS ?? "120");

if (!keypairPath) {
	throw new Error("set LOOTBOX_DEVNET_KEYPAIR to a devnet-only keypair file");
}

const rpc = createSolanaRpc(rpcUrl);
const genesis = await rpc.getGenesisHash().send();

if (genesis !== DEVNET_GENESIS) {
	throw new Error(`refusing to run: ${rpcUrl} is not Solana devnet`);
}

const program = await rpc.getAccountInfo(LOOTBOX_PROGRAM_PROGRAM_ADDRESS, {
	encoding: "base64",
}).send();

if (!program.value?.executable) {
	throw new Error(
		`lootbox program ${LOOTBOX_PROGRAM_PROGRAM_ADDRESS} is not deployed on devnet; run deploy:devnet first`,
	);
}

const payer = await createKeyPairSignerFromBytes(
	Uint8Array.from(
		JSON.parse(readFileSync(resolve(process.cwd(), keypairPath), "utf8")),
	),
);
const steps: Step[] = [];
let phase: Step["phase"] = "setup";
const pending: Promise<void>[] = [];

async function record(label: string, signature: Signature) {
	for (let attempt = 0; attempt < 30; attempt++) {
		const transaction = await rpc.getTransaction(signature, {
			commitment: "confirmed",
			encoding: "json",
			maxSupportedTransactionVersion: 0,
		}).send();

		if (transaction?.meta) {
			const index = transaction.transaction.message.accountKeys.indexOf(
				payer.address,
			);
			const before = transaction.meta.preBalances[index] ?? 0n;
			const after = transaction.meta.postBalances[index] ?? 0n;

			steps.push({
				phase,
				label,
				signature,
				fee: transaction.meta.fee,
				payerDelta: after - before,
			});
			return;
		}

		await new Promise((done) => setTimeout(done, 1_000));
	}

	throw new Error(`transaction ${signature} never reached confirmed`);
}

const client = new LootboxClient(rpcUrl, payer, (message, signature) => {
	if (!signature) {
		console.log(`… ${message}`);
		return;
	}

	console.log(`✓ ${message}  ${signature}`);
	pending.push(record(message, signature as Signature));
});
const oracle = createSwitchboardOracle({ rpcUrl, cluster: "devnet" });
const balance = async () =>
	(await rpc.getBalance(payer.address, { commitment: "confirmed" }).send())
		.value;

console.log(`payer ${payer.address} · ${await balance()} lamports`);

// Setup: a test SPL prize and a two-bundle treasury.
const prizeMint = await generateKeyPairSigner();
const templateMint = await generateKeyPairSigner();
const templateId = BigInt(Date.now());
const tokenPrize = await client.createFixedSupplyMint(prizeMint, 1_000n, 0);
const slot = await rpc.getSlot({ commitment: "confirmed" }).send();
const chainTime = await rpc.getBlockTime(slot).send();
const plan = createTemplatePlan({
	name: "Switchboard devnet e2e",
	uri: "https://example.com/lootbox-e2e.json",
	opensAt: chainTime + revealDelay,
	bundles: [
		{
			label: "SOL",
			quantity: 1n,
			assets: [{ kind: "sol", lamports: 1_000_000n }],
		},
		{
			label: "Token",
			quantity: 1n,
			assets: [{
				kind: "token",
				mint: tokenPrize,
				amount: 500n,
				tokenProgram: CLASSIC_TOKEN_PROGRAM,
				decimals: 0,
			}],
		},
	],
});
let template = await client.createTemplate(
	plan,
	templateId,
	templateMint,
	SWITCHBOARD_PROGRAM.devnet,
	oracle.queue,
);

template = await client.lockTreasury(template);
console.log(`template ${template.address} locked; reveal at ${plan.opensAt}`);

// Openings are only accepted after the reveal date.
for (;;) {
	const now = await rpc.getBlockTime(
		await rpc.getSlot({ commitment: "confirmed" }).send(),
	).send();

	if (now >= plan.opensAt) break;

	console.log(`… waiting ${plan.opensAt - now}s for the reveal date`);
	await new Promise((done) => setTimeout(done, 10_000));
}

await Promise.all(pending);
phase = "open";

const openStart = await balance();
const opening = await client.requestOpen(template, oracle.selectAccounts);
const randomness: Address = opening.data.randomness;
const accounts = await oracle.accountsFor(randomness);

console.log(`randomness ${randomness} bound to oracle ${accounts.oracle}`);

const proofStarted = Date.now();
const proof = await oracle.fetchProof(randomness);

console.log(`proof after ${Date.now() - proofStarted}ms`);

template = await client.template(template.address);
await client.settle(template, opening, accounts, proof);
await client.claim(opening.address);

const claimed = await fetchTemplateOpeningState(
	client.rpc,
	opening.address,
	{ commitment: "confirmed" },
);

await client.closeTemplateOpening(template, claimed, accounts);
await Promise.all(pending);

const openEnd = await balance();
const format = (lamports: bigint) =>
	`${lamports < 0n ? "-" : ""}${(lamports < 0n ? -lamports : lamports)}`
		.padStart(
			12,
		);

console.log("\nPer-transaction cost (payer lamports)");
console.log(
	`${"phase".padEnd(6)} ${"step".padEnd(42)} ${"fee".padStart(12)} ${
		"payer Δ".padStart(12)
	} ${"rent Δ".padStart(12)}  signature`,
);

for (const step of steps) {
	// Rent Δ is the balance change not explained by the fee: negative when
	// rent is locked into new accounts, positive when a close refunds it.
	console.log(
		`${step.phase.padEnd(6)} ${step.label.padEnd(42)} ${format(step.fee)} ${
			format(step.payerDelta)
		} ${format(step.payerDelta + step.fee)}  ${step.signature}`,
	);
}

const openSteps = steps.filter((step) => step.phase === "open");
const openFees = openSteps.reduce((sum, step) => sum + step.fee, 0n);
const openNet = openEnd - openStart;

console.log("\nOne open → reveal → claim → close");
console.log(`  transaction fees      ${openFees} lamports`);
console.log(
	`  net payer change      ${openNet} lamports (includes prize received)`,
);
console.log(
	`  net excluding fees    ${
		openNet + openFees
	} lamports (rent kept + prize - rent refunded)`,
);
console.log(
	`  ≈ ${
		(Number(-openNet) / Number(LAMPORTS_PER_SOL)).toFixed(6)
	} SOL spent net`,
);
