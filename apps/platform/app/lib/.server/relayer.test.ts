import { listTemplateOpenings, relayTemplateOpenings } from "@pina-rs/lootbox";
import {
	createKeyPairSignerFromPrivateKeyBytes,
	getAddressEncoder,
} from "@solana/kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	acquireLease,
	lootboxesOnClusters,
	type LootboxRecord,
	recordRelayerEvent,
	relayerCursor,
	releaseLease,
	saveRelayerCursor,
} from "./db.js";
import { readServerConfig, type WorkerEnv } from "./env.js";
import { RELAYER_RUN_LIMITS } from "./relayer-budget.js";
import { runRelayer } from "./relayer.js";

vi.mock("@pina-rs/lootbox", async (importOriginal) => ({
	...await importOriginal<typeof import("@pina-rs/lootbox")>(),
	relayTemplateOpenings: vi.fn(),
}));

vi.mock("./db.js", () => ({
	acquireLease: vi.fn(),
	lootboxesOnClusters: vi.fn(),
	recordRelayerEvent: vi.fn(),
	relayerCursor: vi.fn(),
	releaseLease: vi.fn(),
	saveRelayerCursor: vi.fn(),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

function unsupported(): never {
	throw new Error("Unexpected binding access");
}

async function environment(): Promise<WorkerEnv> {
	const seed = new Uint8Array(32).fill(7);
	const signer = await createKeyPairSignerFromPrivateKeyBytes(seed);

	return {
		DB: {
			prepare: unsupported,
			batch: unsupported,
			exec: unsupported,
			dump: unsupported,
			withSession: unsupported,
		},
		get MEDIA(): never {
			return unsupported();
		},
		PUBLIC_ORIGIN: "https://app.example",
		DEFAULT_CLUSTER: "devnet",
		ENABLED_CLUSTERS: "devnet",
		RPC_URL_DEVNET: "https://rpc.test",
		RPC_URL_MAINNET: "",
		LOCALNET_CONTROL_URL: "",
		RELAYER_CLUSTERS: "devnet",
		RELAYER_CLAIM: "false",
		FEATURE_EXCLUSIVE_NFTS: "false",
		FEATURE_NFT_PRIZES: "false",
		FEATURE_BOX_CURVES: "false",
		PROGRAM_LUT_DEVNET: "",
		PROGRAM_LUT_MAINNET: "",
		EXCLUSIVE_COLLECTION_DEVNET: "",
		EXCLUSIVE_COLLECTION_MAINNET: "",
		RELAYER_SECRET_KEY: JSON.stringify([
			...seed,
			...getAddressEncoder().encode(signer.address),
		]),
	};
}

function lootbox(id: number, template: string): LootboxRecord {
	return {
		id,
		template,
		slug: `box${id}`,
		cluster: "devnet",
		boxMint: template,
		creator: template,
		title: "Box",
		symbol: "BOX",
		tagline: "",
		descriptionMd: "",
		coverKey: null,
		accent: "teal",
		links: [],
		visibility: "public",
		bundles: [],
		createdAt: 0,
		updatedAt: 0,
	};
}

describe("hosted relayer backlog isolation", () => {
	it("refuses hosted claim rent before acquiring a lease", async () => {
		const env = await environment();

		await expect(runRelayer(env, {
			...readServerConfig(env),
			relayerClaim: true,
		}, () => 100)).rejects.toThrow("RELAYER_CLAIM=false");
		expect(acquireLease).not.toHaveBeenCalled();
		expect(relayTemplateOpenings).not.toHaveBeenCalled();
	});

	it("does not extend its deadline after a delayed lease acknowledgement", async () => {
		const env = await environment();
		let now = 100;
		vi.mocked(acquireLease).mockImplementation(async () => {
			now += RELAYER_RUN_LIMITS.durationSeconds;

			return true;
		});
		vi.mocked(relayerCursor).mockResolvedValue(0);
		vi.mocked(lootboxesOnClusters).mockResolvedValue([
			lootbox(1, "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"),
		]);
		vi.mocked(releaseLease).mockResolvedValue();

		expect(await runRelayer(env, readServerConfig(env), () => now))
			.toEqual({ ran: true, lootboxes: 0, advanced: 0 });
		expect(saveRelayerCursor).not.toHaveBeenCalled();
		expect(relayTemplateOpenings).not.toHaveBeenCalled();
		expect(releaseLease).toHaveBeenCalledOnce();
	});

	it("cancels an oversized template before decoding and advances the next cursor", async () => {
		const env = await environment();
		const first = lootbox(1, "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
		const second = lootbox(2, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
		let canceled = false;
		vi.stubGlobal("fetch", async () =>
			new Response(
				new ReadableStream({
					pull(controller) {
						controller.enqueue(new Uint8Array(64 * 1024));
					},
					cancel() {
						canceled = true;
					},
				}),
			));
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.mocked(acquireLease).mockResolvedValue(true);
		vi.mocked(relayerCursor).mockResolvedValue(0);
		vi.mocked(lootboxesOnClusters).mockResolvedValue([first, second]);
		vi.mocked(saveRelayerCursor).mockResolvedValue();
		vi.mocked(recordRelayerEvent).mockResolvedValue();
		vi.mocked(releaseLease).mockResolvedValue();
		vi.mocked(relayTemplateOpenings)
			.mockImplementationOnce(async (options) => {
				await listTemplateOpenings(options.client.rpc, options.template);

				return { advanced: 99, blocked: false };
			})
			.mockResolvedValueOnce({ advanced: 1, blocked: false });

		expect(await runRelayer(env, readServerConfig(env), () => 100))
			.toEqual({ ran: true, lootboxes: 2, advanced: 1 });
		expect(canceled).toBe(true);
		expect(vi.mocked(saveRelayerCursor).mock.calls.map((call) => call[1]))
			.toEqual([1, 2]);
		expect(releaseLease).toHaveBeenCalledOnce();
	});
});
