import { describe, expect, it } from "vitest";

import { explorerUrl, readLaunchConfig } from "./config.js";

const TREASURY = "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF";
const OTHER = "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh";

describe("launch config", () => {
	it("defaults to localnet without a treasury", () => {
		expect(readLaunchConfig({})).toEqual({
			cluster: "localnet",
			rpcUrl: "",
			treasury: null,
		});
	});

	it("uses public RPC defaults and the build-time treasury", () => {
		expect(
			readLaunchConfig({
				VITE_SOLANA_CLUSTER: "devnet",
				VITE_TREASURY: TREASURY,
			}),
		).toEqual({
			cluster: "devnet",
			rpcUrl: "https://api.devnet.solana.com",
			treasury: TREASURY,
		});
	});

	it("only lets the query string override the treasury on localnet", () => {
		expect(readLaunchConfig({}, `?treasury=${OTHER}`).treasury).toBe(OTHER);
		expect(
			readLaunchConfig(
				{ VITE_SOLANA_CLUSTER: "mainnet", VITE_TREASURY: TREASURY },
				`?treasury=${OTHER}`,
			).treasury,
		).toBe(TREASURY);
	});

	it("rejects invalid clusters and addresses", () => {
		expect(() => readLaunchConfig({ VITE_SOLANA_CLUSTER: "testnet" })).toThrow(
			/VITE_SOLANA_CLUSTER/,
		);
		expect(() => readLaunchConfig({ VITE_TREASURY: "nope" })).toThrow(
			/not a valid Solana address/,
		);
	});

	it("builds explorer links per cluster", () => {
		expect(explorerUrl({ cluster: "mainnet", rpcUrl: "" }, "tx", "abc")).toBe(
			"https://explorer.solana.com/tx/abc",
		);
		expect(explorerUrl({ cluster: "devnet", rpcUrl: "" }, "address", "abc"))
			.toBe("https://explorer.solana.com/address/abc?cluster=devnet");
		expect(
			explorerUrl(
				{ cluster: "localnet", rpcUrl: "http://127.0.0.1:9" },
				"tx",
				"a",
			),
		).toContain("cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A9");
	});
});
