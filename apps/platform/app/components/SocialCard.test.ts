import { ImageResponse } from "@cf-wasm/og/node";
import { writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SocialCard } from "./SocialCard.js";

describe("social card image boundary", () => {
	it("renders a bounded PNG without fetching uploaded images", async () => {
		const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(
			new Error("Unexpected image fetch"),
		);

		try {
			const response = await ImageResponse.async(
				createElement(SocialCard, {
					record: {
						title: "Treasure chest",
						tagline: "A little surprise",
						accent: "teal",
					},
					status: "Open now",
				}),
				{ width: 1200, height: 630 },
			);
			const bytes = new Uint8Array(await response.arrayBuffer());
			const header = new DataView(bytes.buffer);

			expect(Array.from(bytes.subarray(0, 8))).toEqual([
				137,
				80,
				78,
				71,
				13,
				10,
				26,
				10,
			]);
			expect([header.getUint32(16), header.getUint32(20)]).toEqual([1200, 630]);
			expect(fetch).not.toHaveBeenCalled();

			if (process.env.LOOTBOX_SOCIAL_CARD_PROOF) {
				writeFileSync(process.env.LOOTBOX_SOCIAL_CARD_PROOF, bytes);
			}
		} finally {
			fetch.mockRestore();
		}
	}, 30_000);

	it.each(["png", "jpg", "gif", "webp"])(
		"never passes an uploaded %s into the server image decoder",
		(extension) => {
			const record = {
				title: "My chest",
				tagline: "A prize",
				accent: "teal",
				coverKey: `c-bomb.${extension}`,
			};
			const html = renderToStaticMarkup(
				createElement(SocialCard, { record, status: "Open now" }),
			);
			const sources = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((
				match,
			) => match[1]);

			expect(sources).toHaveLength(2);
			expect(
				sources.every((src) => src?.startsWith("data:image/svg+xml;utf8,")),
			).toBe(true);
			expect(html).not.toContain(record.coverKey);
			expect(html).toContain("My chest");
			expect(html).toContain("Open now");
		},
	);
});
