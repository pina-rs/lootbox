import { expect, test } from "@playwright/test";

/**
 * The GitHub Pages build lives under `/lootbox/`. Every script, stylesheet,
 * image, clip, and metadata file must resolve under that base path.
 */
/** Only the static site's own files count; the playground may probe its
 * local control plane, which is not part of the Pages build. */
const SITE_PORT = "4174";

test("a base-path build resolves every asset and route", async ({ page, request }) => {
	const failures: string[] = [];

	page.on("response", (response) => {
		const url = new URL(response.url());

		if (url.port === SITE_PORT && response.status() >= 400) {
			failures.push(`${response.status()} ${url.pathname}`);
		}
	});
	page.on("requestfailed", (failed) => {
		const url = new URL(failed.url());

		if (url.port === SITE_PORT) failures.push(`failed ${url.pathname}`);
	});

	await page.goto("./");
	await expect(page.getByRole("heading", { level: 1 })).toContainText(
		"pre-IPO exposure",
	);
	await expect(page.getByRole("list", { name: "Planned prizes" }))
		.toBeVisible();

	const images = page.locator("img");

	await images.last().scrollIntoViewIfNeeded();
	await expect.poll(() =>
		images.evaluateAll((all) =>
			all.filter((image) =>
				!(image as HTMLImageElement).complete ||
				(image as HTMLImageElement).naturalWidth === 0
			).length
		)
	).toBe(0);

	for (
		const src of await images.evaluateAll((all) =>
			all.map((image) => image.getAttribute("src") ?? "")
		)
	) {
		expect(src.startsWith("/lootbox/")).toBe(true);
	}

	await expect(page.getByRole("link", { name: "Creator playground" }))
		.toHaveAttribute("href", "/lootbox/playground");

	for (
		const file of [
			"animations/cartoon-chest/big-prize.webm",
			"animations/cartoon-chest/small-prize.mp4",
			"animations/cartoon-chest/disappointed.webm",
			"animations/cartoon-chest/disappointed-final.webp",
			"metadata/box.png",
			"metadata/empty-box.png",
			"nft/empty-chest/0.png",
			"nft/empty-chest/12.png",
			"nft/empty-chest/empty-chest.riv",
			"nft/empty-chest/play.html",
		]
	) {
		expect((await request.get(file)).status(), file).toBe(200);
	}

	for (let variant = 0; variant < 13; variant++) {
		const body: unknown = await (
			await request.get(`nft/empty-chest/${variant}.json`)
		).json();

		expect(body).toMatchObject({
			name: expect.stringMatching(/^Empty Chest #\d+ — /),
			symbol: "EMPTY",
			image: `https://pina-rs.github.io/lootbox/nft/empty-chest/${variant}.png`,
			animation_url:
				`https://pina-rs.github.io/lootbox/nft/empty-chest/play.html?v=${variant}`,
			properties: { category: "html" },
		});
	}

	for (const file of ["metadata/box.json", "metadata/empty-box.json"]) {
		const body: unknown = await (await request.get(file)).json();

		expect(body).toMatchObject({
			image: expect.stringMatching(
				/^https:\/\/pina-rs\.github\.io\/lootbox\/metadata\/.+\.png$/,
			),
			external_url: "https://pina-rs.github.io/lootbox/",
		});
	}

	await page.goto("./rules");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"Official rules",
	);
	await expect(page.getByRole("link", { name: "Back to Unlisted" }))
		.toHaveAttribute("href", "/lootbox/");

	await page.goto("./playground");
	await expect(page.getByRole("navigation", { name: "Workspace" }))
		.toBeVisible();
	expect(failures).toEqual([]);
});
