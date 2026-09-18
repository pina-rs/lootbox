import { expect, test } from "@playwright/test";

test("plays all native Rive reactions, finishes, replays, and skips", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	await page.goto("/reveal-preview.html");
	const machine = page.getByTestId("lootbox-machine");
	for (
		const [label, outcome] of [["Wish granted", "big-prize"], [
			"A nice surprise",
			"small-prize",
		], ["Not this time", "disappointed"]] as const
	) {
		await page.getByRole("button", { name: new RegExp(label) }).click();
		await expect(machine).toHaveAttribute("data-outcome", outcome);
		await expect(machine).toHaveAttribute("data-playback", "playing");
		await expect(machine).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
		// A transparent canvas must not expose the closed-chest poster underneath.
		await expect(machine.locator("img")).toBeHidden();
		const canvas = machine.locator("canvas");
		const firstFrame = await canvas.evaluate((element: HTMLCanvasElement) =>
			element.toDataURL()
		);
		await expect.poll(() =>
			canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
		).not.toBe(firstFrame);
		expect(
			await canvas.evaluate((element: HTMLCanvasElement) => {
				const context = element.getContext("2d");
				if (!context) throw new Error("Missing Rive canvas context");
				return context.getImageData(0, 0, 1, 1).data[3];
			}),
		).toBe(0);
		// The native five-second timeline must complete before the eight-second watchdog.
		await expect(page.getByRole("button", { name: "Skip animation" }))
			.toBeHidden({ timeout: 6_500 });
		await expect(machine.locator("img")).toHaveAttribute(
			"src",
			`/animations/ink-chest/${outcome}.png`,
		);
	}
	await page.getByRole("button", { name: /Wish granted/ }).click();
	await expect(machine).toHaveAttribute("data-playback", "playing");
	await page.getByRole("button", { name: /Not this time/ }).click();
	await expect(machine).toHaveAttribute("data-outcome", "disappointed");
	await expect(machine).toHaveAttribute("data-playback", "playing");
	await page.getByRole("button", { name: "Skip animation" }).click();
	await expect(machine.locator("canvas")).toHaveCount(0);
	await expect(page.getByRole("status")).toContainText("Choose a reaction");
	expect(errors).toEqual([]);
	expect(
		await page.evaluate(() =>
			document.documentElement.scrollWidth > innerWidth
		),
	).toBe(false);
});

test("all fallback stills retain transparent backgrounds and visible artwork", async ({ page }) => {
	await page.goto("/reveal-preview.html");
	for (const name of ["closed", "big-prize", "small-prize", "disappointed"]) {
		const alpha = await page.evaluate(async (name) => {
			const image = new Image();
			image.src = `/animations/ink-chest/${name}.png`;
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Missing PNG inspection context");
			context.drawImage(image, 0, 0);
			return ([[0, 0], [639, 0], [0, 639], [639, 639], [320, 440]] as const)
				.map(
					([x, y]) => context.getImageData(x, y, 1, 1).data[3],
				);
		}, name);
		expect(alpha, `${name} alpha: four transparent corners and opaque chest`)
			.toEqual([0, 0, 0, 0, 255]);
	}
});

test("reduced motion shows the outcome without downloading Rive", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const animationRequests: string[] = [];
	page.on("request", (request) => {
		if (/\.(riv|wasm)(\?|$)/.test(request.url())) {
			animationRequests.push(request.url());
		}
	});
	await page.goto("/reveal-preview.html");
	await page.getByRole("button", { name: /Wish granted/ }).click();
	await expect(page.getByTestId("lootbox-machine").locator("img"))
		.toHaveAttribute("src", "/animations/ink-chest/big-prize.png");
	await expect(page.locator("canvas")).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Skip animation" }))
		.toBeHidden();
	expect(animationRequests).toEqual([]);
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.getByRole("button", { name: /Wish granted/ }).click();
	await expect(page.getByTestId("lootbox-machine")).toHaveAttribute(
		"data-playback",
		"playing",
	);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(page.locator("canvas")).toHaveCount(0);
});

test("a failed Rive download leaves the outcome available", async ({ page }) => {
	await page.route("**/ink-chest.riv", (route) => route.abort());
	await page.goto("/reveal-preview.html");
	await page.getByRole("button", { name: /A nice surprise/ }).click();
	await expect(page.getByRole("button", { name: "Skip animation" }))
		.toBeHidden();
	await expect(page.getByTestId("lootbox-machine").locator("img"))
		.toHaveAttribute("src", "/animations/ink-chest/small-prize.png");
	await expect(page.getByRole("status")).toContainText("Choose a reaction");
});
