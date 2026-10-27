/**
 * Bootstrap the program address lookup table for one cluster.
 *
 *   pnpm --dir sdks/typescript bootstrap:lut -- --cluster <devnet|mainnet> \
 *     --keypair <path> [--rpc <url>]
 *
 * Creates a lookup table owned by the keypair and extends it with the static
 * accounts every lootbox opening flow passes: programs, sysvars, and mints.
 * Pass the printed address to `LootboxClient` as a `lookupTableAddresses`
 * entry (and to the platform relayer through its environment) so sent
 * transactions compress those accounts instead of spelling them out.
 *
 * A table becomes usable once the slot it was created in is confirmed; the
 * script waits for that and verifies the table on chain before exiting.
 */
import * as generated from "@pina-rs/lootbox-program-client";
import { getCreateLookupTableInstruction } from "@solana-program/address-lookup-table";
import { getExtendLookupTableInstruction } from "@solana-program/address-lookup-table";
import { findAddressLookupTablePda } from "@solana-program/address-lookup-table";
import { type Address, address } from "@solana/kit";
import {
	BOX_TOKEN_PROGRAM,
	CLASSIC_TOKEN_PROGRAM,
	LootboxClient,
	SWITCHBOARD_PROGRAM,
} from "../src/index.js";
import {
	installPatientFetch,
	loadKeypair,
	parseArgs,
	parseCluster,
	verifiedRpcUrl,
} from "./cli.js";

/** Extend instructions stay far below the transaction account limit. */
const EXTEND_CHUNK = 20;

const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const CLOCK_SYSVAR = address("SysvarC1ock11111111111111111111111111111111");
const SLOT_HASHES_SYSVAR = address(
	"SysvarS1otHashes111111111111111111111111111",
);
const RENT_SYSVAR = address("SysvarRent111111111111111111111111111111111");
const INSTRUCTIONS_SYSVAR = address(
	"Sysvar1nstructions1111111111111111111111111",
);
const COMPUTE_BUDGET_PROGRAM = address(
	"ComputeBudget111111111111111111111111111111",
);
const WRAPPED_SOL_MINT = address(
	"So11111111111111111111111111111111111111112",
);
const ASSOCIATED_TOKEN_PROGRAM = address(
	"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

installPatientFetch();

const args = parseArgs(process.argv.slice(2));
const cluster = parseCluster(args.required("cluster"));
const rpcUrl = await verifiedRpcUrl(cluster, args.optional("rpc"));
const payer = await loadKeypair(args.required("keypair"));
const client = new LootboxClient(rpcUrl, payer, (message, signature) => {
	if (signature) {
		console.log(JSON.stringify({ event: "transaction", message, signature }));
	}
});

const epoch = await client.rpc.getEpochInfo().send();
const recentSlot = epoch.absoluteSlot;
const table = await findAddressLookupTablePda({
	authority: payer.address,
	recentSlot,
});
const members: Address[] = [
	generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
	SWITCHBOARD_PROGRAM[cluster],
	SYSTEM_PROGRAM,
	COMPUTE_BUDGET_PROGRAM,
	BOX_TOKEN_PROGRAM,
	CLASSIC_TOKEN_PROGRAM,
	ASSOCIATED_TOKEN_PROGRAM,
	WRAPPED_SOL_MINT,
	CLOCK_SYSVAR,
	SLOT_HASHES_SYSVAR,
	RENT_SYSVAR,
	INSTRUCTIONS_SYSVAR,
];

console.log(
	JSON.stringify({
		event: "creating",
		table: table[0],
		authority: payer.address,
		recentSlot: recentSlot.toString(),
		members: members.length,
	}),
);

await client.send(
	[
		getCreateLookupTableInstruction({
			address: table,
			authority: payer,
			payer,
			recentSlot,
		}),
	],
	"create lookup table",
);

for (let index = 0; index < members.length; index += EXTEND_CHUNK) {
	const chunk = members.slice(index, index + EXTEND_CHUNK);

	await client.send(
		[
			getExtendLookupTableInstruction({
				address: table[0],
				authority: payer,
				payer,
				addresses: [...chunk],
			}),
		],
		`extend lookup table ${index / EXTEND_CHUNK + 1}`,
	);
}

const confirmed = await client.rpc
	.getSlot({ commitment: "confirmed" })
	.send();

if (confirmed < recentSlot) {
	console.log(
		JSON.stringify({
			event: "waiting_for_confirmation",
			createdAt: recentSlot.toString(),
			confirmed: confirmed.toString(),
		}),
	);

	while (true) {
		const slot = await client.rpc
			.getSlot({ commitment: "confirmed" })
			.send();

		if (slot >= recentSlot) break;

		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}

const fetched = await client.rpc
	.getAccountInfo(table[0], {
		encoding: "base64",
		commitment: "confirmed",
	})
	.send();

if (!fetched) {
	throw new Error(`lookup table ${table[0]} did not appear on chain`);
}

console.log(
	JSON.stringify({
		event: "ready",
		table: table[0],
		members: members.length,
		note:
			"pass this address to LootboxClient lookupTableAddresses (or the platform relayer environment)",
	}),
);
