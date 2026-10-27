import { type Address, address, getAddressEncoder } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { base58Bytes, type LootboxRpc } from "./client.js";
import { listTemplateOpenings } from "./relayer.js";

const PROGRAM_ADDRESS = address("LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E");
const TEMPLATE = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const BENEFICIARY = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

type MemcmpFilter = Readonly<{
	bytes: string;
	encoding: "base58";
	offset: bigint;
}>;

type ProgramAccountsFilter = Readonly<{ memcmp: MemcmpFilter }>;

/** Capture the `getProgramAccounts` filters one listing sends. */
function listingRpc() {
	const calls: { filters: readonly ProgramAccountsFilter[] }[] = [];
	const rpc = {
		getProgramAccounts: (
			_program: Address,
			config: { filters: readonly ProgramAccountsFilter[] },
		) => ({
			send: async () => {
				calls.push({ filters: config.filters });

				return [];
			},
		}),
	} as unknown as LootboxRpc;

	return { calls, rpc };
}

describe("listTemplateOpenings", () => {
	it("lists every opening of a template", async () => {
		const { calls, rpc } = listingRpc();
		const openings = await listTemplateOpenings(rpc, TEMPLATE);

		expect(openings).toEqual([]);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.filters).toHaveLength(2);
	});

	it("pushes the beneficiary filter on chain", async () => {
		const { calls, rpc } = listingRpc();
		const openings = await listTemplateOpenings(rpc, TEMPLATE, {
			beneficiary: BENEFICIARY,
		});

		expect(openings).toEqual([]);
		expect(calls[0]?.filters).toHaveLength(3);

		const beneficiaryFilter = calls[0]?.filters[2]?.memcmp;

		// `beneficiary` follows the discriminator, version, template, and box
		// authority: 2 + 32 + 32.
		expect(beneficiaryFilter?.offset).toBe(66n);
		expect(beneficiaryFilter?.bytes).toBe(
			base58Bytes(new Uint8Array(getAddressEncoder().encode(BENEFICIARY))),
		);
	});
});
