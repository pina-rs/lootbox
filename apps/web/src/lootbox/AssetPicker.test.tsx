import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetPicker } from "./AssetPicker.js";
import type { DraftAsset } from "./playground.js";

const owner = "9xQeWvG816bUx9EPfEZ1Wq6uH3jZpH9x6J4f5P2m3N7a";
const tree = "7RmhTYBS7Uv9PSNmJGX6tM8BjSn7HVbGdVgV6EtCNKLm";
const otherTree = "So11111111111111111111111111111111111111112";
const alpha = "Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op";
const beta = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const mutable = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6XKj7D3WpqkDmzPK";
const delegated = "4Nd1mYUc7QbTEnYUNQhTxYRYgP5gN9Z8RzBf8nGvXw4X";
const outsider = "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2";
const dataHash = "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK";
const creatorHash = "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV";

function response(value: unknown) {
	return Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
}

afterEach(() => vi.unstubAllGlobals());

describe("PrizePool asset composer", () => {
	it("shows the custody plan, locks selection to one tree, and revalidates every proof", async () => {
		const fetch = vi.fn((input: string | URL | Request) => {
			const url = new URL(String(input));
			if (url.pathname === "/assets/tokens") {
				return response({ items: [], source: "live" });
			}
			if (url.pathname === "/assets/nfts") {
				return response({
					source: "live",
					items: [
						{
							id: alpha,
							name: "Alpha",
							standard: "V1_NFT",
							compressed: true,
							mutable: false,
							delegated: false,
							tree,
							leafIndex: 7,
							dataHash,
							creatorHash,
							owner,
						},
						{
							id: beta,
							name: "Beta",
							standard: "V1_NFT",
							compressed: true,
							mutable: false,
							delegated: false,
							tree,
							leafIndex: 11,
							dataHash,
							creatorHash,
							owner,
						},
						{
							id: mutable,
							name: "Mutable decoy",
							standard: "V1_NFT",
							compressed: true,
							mutable: true,
							delegated: false,
							tree,
							leafIndex: 13,
							dataHash,
							creatorHash,
							owner,
						},
						{
							id: outsider,
							name: "Other tree",
							standard: "V1_NFT",
							compressed: true,
							mutable: false,
							delegated: false,
							tree: otherTree,
							leafIndex: 17,
							dataHash,
							creatorHash,
							owner,
						},
						{
							id: delegated,
							name: "Delegated decoy",
							standard: "V1_NFT",
							compressed: true,
							mutable: false,
							delegated: true,
							tree,
							leafIndex: 19,
							dataHash,
							creatorHash,
							owner,
						},
					],
				});
			}
			if (url.pathname === "/assets/nft-proof") {
				const asset = url.searchParams.get("id");
				return response({
					asset,
					owner,
					delegated: false,
					tree,
					treeConfig: tree,
					leafIndex: asset === alpha ? 7 : 11,
					nonce: asset === alpha ? "7" : "11",
					dataHash,
					creatorHash,
					root: tree,
					proof: [],
					metadata: "AQ==",
				});
			}
			throw new Error(`Unexpected request: ${url}`);
		});
		vi.stubGlobal("fetch", fetch);
		const picked: DraftAsset[] = [];
		const user = userEvent.setup();

		render(
			<AssetPicker
				owner={owner}
				onClose={() => undefined}
				onPick={(asset) => picked.push(asset)}
			/>,
		);
		await user.click(screen.getByRole("button", { name: "Build PrizePool" }));
		const alphaButton = await screen.findByRole("button", { name: /Alpha/ });
		const betaButton = screen.getByRole("button", { name: /Beta/ });
		const mutableButton = screen.getByRole("button", { name: /Mutable decoy/ });
		const delegatedButton = screen.getByRole("button", {
			name: /Delegated decoy/,
		});
		const otherTreeButton = screen.getByRole("button", { name: /Other tree/ });
		expect(mutableButton).toBeDisabled();
		expect(delegatedButton).toBeDisabled();

		await user.click(alphaButton);
		expect(otherTreeButton).toBeDisabled();
		await user.click(betaButton);
		expect(screen.getByText("6 resumable setup transactions")).toBeVisible();
		const selected = screen.getByRole("list", {
			name: "Selected compressed NFTs",
		});
		expect(within(selected).getAllByRole("listitem")).toHaveLength(2);
		expect(screen.getByText("PDA custody after deposit")).toBeVisible();
		expect(screen.getByText("Winner chosen from draw entropy")).toBeVisible();

		await user.click(
			screen.getByRole("button", { name: "Add 2 NFT PrizePool" }),
		);
		expect(picked).toHaveLength(1);
		expect(picked[0]).toMatchObject({
			kind: "prizePool",
			mint: tree,
			amount: "1",
		});
		expect(picked[0]?.poolItems).toHaveLength(2);
		expect(
			fetch.mock.calls.filter(([value]) =>
				String(value).includes("/assets/nft-proof")
			),
		).toHaveLength(2);
	});

	it("rejects a proof refresh when ownership changed after selection", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				const url = new URL(String(input));
				if (url.pathname === "/assets/tokens") {
					return response({ items: [], source: "live" });
				}
				if (url.pathname === "/assets/nfts") {
					return response({
						source: "live",
						items: [{
							id: alpha,
							name: "Alpha",
							standard: "V1_NFT",
							compressed: true,
							mutable: false,
							delegated: false,
							tree,
							leafIndex: 7,
							dataHash,
							creatorHash,
							owner,
						}],
					});
				}
				return response({
					asset: alpha,
					owner: outsider,
					delegated: false,
					tree,
					treeConfig: tree,
					leafIndex: 7,
					nonce: "7",
					dataHash,
					creatorHash,
					root: tree,
					proof: [],
					metadata: "AQ==",
				});
			}),
		);
		const user = userEvent.setup();
		render(
			<AssetPicker
				owner={owner}
				onClose={() => undefined}
				onPick={() => undefined}
			/>,
		);
		await user.click(screen.getByRole("button", { name: "Build PrizePool" }));
		await user.click(await screen.findByRole("button", { name: /Alpha/ }));
		await user.click(
			screen.getByRole("button", { name: "Add 1 NFT PrizePool" }),
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			/DAS proof changed the selected compressed NFT identity/,
		);
	});

	it("invalidates an in-flight proof refresh when the picker is dismissed", async () => {
		let resolveProof: ((response: Response) => void) | undefined;
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				const url = new URL(String(input));
				if (url.pathname === "/assets/tokens") {
					return response({ items: [], source: "live" });
				}
				if (url.pathname === "/assets/nfts") {
					return response({
						source: "live",
						items: [{
							id: alpha,
							name: "Alpha",
							standard: "V1_NFT",
							compressed: true,
							mutable: false,
							delegated: false,
							tree,
							leafIndex: 7,
							dataHash,
							creatorHash,
							owner,
						}],
					});
				}
				return new Promise<Response>((resolve) => {
					resolveProof = resolve;
				});
			}),
		);
		const onClose = vi.fn();
		const onPick = vi.fn();
		const user = userEvent.setup();
		render(<AssetPicker owner={owner} onClose={onClose} onPick={onPick} />);

		await user.click(screen.getByRole("button", { name: "Build PrizePool" }));
		await user.click(await screen.findByRole("button", { name: /Alpha/ }));
		await user.click(
			screen.getByRole("button", { name: "Add 1 NFT PrizePool" }),
		);
		await user.click(
			screen.getByRole("button", { name: "Close asset picker" }),
		);
		resolveProof?.(
			new Response(
				JSON.stringify({
					asset: alpha,
					owner,
					delegated: false,
					tree,
					treeConfig: tree,
					leafIndex: 7,
					nonce: "7",
					dataHash,
					creatorHash,
					root: tree,
					proof: [],
					metadata: "AQ==",
				}),
				{ status: 200 },
			),
		);

		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
		expect(onPick).not.toHaveBeenCalled();
	});

	it("clears selected leaves when the funding wallet changes", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				const url = new URL(String(input));
				if (url.pathname === "/assets/tokens") {
					return response({ items: [], source: "live" });
				}
				return response({
					source: "live",
					items: [{
						id: alpha,
						name: "Alpha",
						standard: "V1_NFT",
						compressed: true,
						mutable: false,
						delegated: false,
						tree,
						leafIndex: 7,
						dataHash,
						creatorHash,
						owner,
					}],
				});
			}),
		);
		const user = userEvent.setup();
		const { rerender } = render(
			<AssetPicker
				owner={owner}
				onClose={() => undefined}
				onPick={() => undefined}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Build PrizePool" }));
		await user.click(await screen.findByRole("button", { name: /Alpha/ }));
		expect(screen.getByRole("list", { name: "Selected compressed NFTs" }))
			.toBeVisible();
		rerender(
			<AssetPicker
				owner={outsider}
				onClose={() => undefined}
				onPick={() => undefined}
			/>,
		);

		await waitFor(() =>
			expect(
				screen.queryByRole("list", { name: "Selected compressed NFTs" }),
			).not.toBeInTheDocument()
		);
		expect(screen.getByRole("button", { name: /Add NFT PrizePool/ }))
			.toBeDisabled();
	});

	it("ignores an older catalog response after the funding wallet changes", async () => {
		const pending: Array<(response: Response) => void> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				const url = new URL(String(input));
				if (url.pathname === "/assets/tokens") {
					return response({ items: [], source: "live" });
				}
				return new Promise<Response>((resolve) => pending.push(resolve));
			}),
		);
		const user = userEvent.setup();
		const { rerender } = render(
			<AssetPicker
				owner={owner}
				onClose={() => undefined}
				onPick={() => undefined}
			/>,
		);
		await user.click(screen.getByRole("button", { name: "Build PrizePool" }));
		await waitFor(() => expect(pending).toHaveLength(1));
		rerender(
			<AssetPicker
				owner={outsider}
				onClose={() => undefined}
				onPick={() => undefined}
			/>,
		);
		await waitFor(() => expect(pending).toHaveLength(2));
		pending[1]?.(
			new Response(
				JSON.stringify({
					source: "live",
					items: [{
						id: beta,
						name: "New wallet leaf",
						standard: "V1_NFT",
						compressed: true,
						mutable: false,
						delegated: false,
						tree,
						leafIndex: 11,
						dataHash,
						creatorHash,
						owner: outsider,
					}],
				}),
				{ status: 200 },
			),
		);
		expect(await screen.findByRole("button", { name: /New wallet leaf/ }))
			.toBeVisible();

		pending[0]?.(
			new Response(
				JSON.stringify({
					source: "live",
					items: [{
						id: alpha,
						name: "Stale wallet leaf",
						standard: "V1_NFT",
						compressed: true,
						mutable: false,
						delegated: false,
						tree,
						leafIndex: 7,
						dataHash,
						creatorHash,
						owner,
					}],
				}),
				{ status: 200 },
			),
		);
		await waitFor(() =>
			expect(screen.queryByRole("button", { name: /Stale wallet leaf/ }))
				.not.toBeInTheDocument()
		);
	});
});
