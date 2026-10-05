import { describe, expect, it } from "vitest";

import { parseDistribution } from "./distribution.js";
import { parseInline, parseMarkdown } from "./markdown.js";
import { boxMetadata, plainText } from "./metadata.js";
import { formatDuration, lootboxStatus } from "./status.js";

const WALLET = "3SWqQpWP5AUyJA5c7kLQdgwP83BLL9p8EH1DkfLTZ3pj";

describe("box metadata JSON", () => {
	it("follows the creator's current display copy", () => {
		const json = boxMetadata({
			slug: "summer-drop-abcde",
			title: "Summer Drop",
			symbol: "SUMMER",
			tagline: "Sun, sea, SOL",
			descriptionMd: "**Hot** prizes. See [rules](https://lootbox.so/r).",
			coverUrl: "https://lootbox.so/media/c-1.png",
		}, "https://lootbox.so");

		expect(json).toEqual({
			name: "Summer Drop",
			symbol: "SUMMER",
			description: "Sun, sea, SOL\n\nHot prizes. See rules.",
			image: "https://lootbox.so/media/c-1.png",
			external_url: "https://lootbox.so/l/summer-drop-abcde",
			attributes: [{ trait_type: "Type", value: "Sealed lootbox" }],
			properties: {
				category: "image",
				files: [{ uri: "https://lootbox.so/media/c-1.png", type: "image/png" }],
			},
		});
	});

	it("falls back to the box art and a default description", () => {
		const json = boxMetadata({
			slug: "x-aaaaa",
			title: "X",
			symbol: "X",
			tagline: "",
			descriptionMd: "",
			coverUrl: null,
		}, "https://lootbox.so");

		expect(json.image).toBe("https://lootbox.so/box.png");
		expect(json.description).toMatch(/lootbox\.so/);
		expect(plainText("- a\n- b")).toBe("• a\n• b");
	});
});

describe("markdown", () => {
	it("renders a safe subset and never raw HTML", () => {
		expect(parseInline("<script>x</script>")).toEqual([
			{ type: "text", text: "<script>x</script>" },
		]);
		expect(parseInline("[bad](javascript:alert(1))")).toEqual([
			{ type: "text", text: "[bad](javascript:alert(1))" },
		]);
		expect(parseMarkdown("## Hi\n\n- **a**\n- b\n\nText")).toEqual([
			{ type: "heading", children: [{ type: "text", text: "Hi" }] },
			{
				type: "list",
				items: [
					[{ type: "strong", children: [{ type: "text", text: "a" }] }],
					[{ type: "text", text: "b" }],
				],
			},
			{ type: "paragraph", children: [{ type: "text", text: "Text" }] },
		]);
	});
});

describe("distribution lists", () => {
	it("merges duplicates and reports bad lines", () => {
		const plan = parseDistribution(
			`# friends\n${WALLET}\n${WALLET}, 2\nnot-a-wallet\n${WALLET} 0`,
		);

		expect(plan.recipients).toEqual([{ address: WALLET, count: 3n }]);
		expect(plan.total).toBe(3n);
		expect(plan.errors).toHaveLength(2);
	});
});

describe("status", () => {
	it("formats the two largest units", () => {
		expect(formatDuration(0)).toBe("0s");
		expect(formatDuration(90)).toBe("1m 30s");
		expect(formatDuration(86_400 + 3_600 * 4 + 5)).toBe("1d 4h");
	});

	it("describes each lifecycle stage", () => {
		const base = {
			status: "live" as const,
			opensAt: 100,
			chainTime: 50,
			remaining: "5",
		};

		expect(lootboxStatus({ ...base, lockedAt: 0 }).label).toBe("Being filled");
		expect(lootboxStatus({ ...base, lockedAt: 10 }).label).toBe("Opens in 50s");
		expect(lootboxStatus({ ...base, lockedAt: 10, chainTime: 100 }).label).toBe(
			"Open now",
		);
		expect(lootboxStatus({ ...base, lockedAt: 10, remaining: "0" }).label).toBe(
			"All opened",
		);
	});
});
