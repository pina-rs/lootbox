import { expect, test } from "@playwright/test";

/**
 * The GitHub Pages build lives under `/lootbox/`. Every script, stylesheet,
 * image, clip, and metadata file must resolve under that base path.
 */
test("a base-path build resolves every asset and route", async ({ page, request }) => {
	const failures: string[] = [];

	page.on("response", (response) => {
		const url = new URL(response.url());

		if (url.hostname === "127.0.0.1" && response.status() >= 400) {
			failures.push(`${response.status()} ${url.pathname}`);
		}
	});
	page.on("requestfailed", (failed) => {
		const url = new URL(failed.url());

		if (url.hostname === "127.0.0.1") failures.push(`failed ${url.pathname}`);
	});

	await page.goto("./");
	await expect(page.getByRole("heading", { level: 1 })).toContainText(
		"pre-IPO stock",
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
		]
	) {
		expect((await request.get(file)).status(), file).toBe(200);
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

	await page.goto("./playground");
	await expect(page.getByRole("navigation", { name: "Workspace" }))
		.toBeVisible();
	expect(failures).toEqual([]);
});
