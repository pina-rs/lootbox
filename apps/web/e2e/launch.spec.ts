import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { generateKeyPairSigner } from "@solana/kit";

import {
	CONTROL,
	createSeries,
	injectTestWallet,
	OPENAI_AMOUNT,
	SPACEX_AMOUNT,
	STOCKS,
	timeTravel,
	tokenBalance,
} from "./support/localnet.js";

/** Collect page errors and console errors; `allow` filters expected noise. */
function watchErrors(page: Page, allow: readonly RegExp[] = []) {
	const errors: string[] = [];

	page.on("pageerror", (error) => errors.push(error.message));
	// Prices ship in the build; the non-CORS PreStocks API must never be
	// called from the browser.
	page.on("request", (request) => {
		if (new URL(request.url()).hostname.endsWith("prestocks.com")) {
			errors.push(`unexpected request to ${request.url()}`);
		}
	});
	page.on("console", (message) => {
		if (message.type() !== "error") return;

		const text = message.text();

		if (!allow.some((pattern) => pattern.test(text))) errors.push(text);
	});

	return errors;
}

async function expectAccessible(page: Page) {
	const results = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa"])
		.analyze();
	const serious = results.violations.filter((violation) =>
		violation.impact === "serious" || violation.impact === "critical"
	).map((violation) => `${violation.id}: ${violation.nodes.length} node(s)`);

	expect(serious).toEqual([]);
}

function chest(page: Page): Locator {
	return page.getByTestId("chest");
}

async function connect(page: Page) {
	await page.getByRole("button", { name: "Connect E2E Wallet" }).click();
	await expect(page.getByRole("button", { name: /Disconnect/ })).toBeVisible();
}

/** Press and hold the chest with a pointer until it commits to opening. */
async function holdChest(page: Page) {
	const target = page.getByRole("button", {
		name: "Press and hold to open a box",
	});
	await target.scrollIntoViewIfNeeded();

	const box = await target.boundingBox();

	if (!box) throw new Error("chest is not visible");

	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await expect(chest(page)).toHaveAttribute(
		"data-phase",
		/burning|rolling|revealing|revealed/,
	);
	await page.mouse.up();
}

/**
 * Finish the reveal: skip the clip if it is still playing. The clip is five
 * seconds long, so on a slow machine it may already have ended.
 */
async function finishReveal(page: Page) {
	const skip = page.getByRole("button", { name: "Skip animation" });
	const card = page.getByTestId("prize-card");

	await expect(skip.or(card).first()).toBeVisible({ timeout: 30_000 });
	await skip.click({ timeout: 1_000 }).catch(() => undefined);
	await expect(card).toBeVisible();
}

async function openSeries(
	page: Page,
	options: { revealed: boolean; kind?: "stocks" | "empty" },
) {
	const wallet = await injectTestWallet(page);
	const series = await createSeries({
		holder: wallet.address,
		...(options.kind ? { kind: options.kind } : {}),
	});

	// Travel well past the reveal so the next produced block is unambiguous.
	if (options.revealed) await timeTravel(series.revealAt + 60n);

	await page.goto(`/?treasury=${series.treasury}`);
	await expect(page.getByTestId("odds-0")).toBeVisible();

	return { wallet, series };
}

/** Claim after the eligibility box is already ticked, and check the balance. */
async function claimAndVerifyCertified(
	page: Page,
	series: Awaited<ReturnType<typeof createSeries>>,
	owner: Parameters<typeof tokenBalance>[1],
) {
	const card = page.getByTestId("prize-card");
	const title = await card.getByRole("heading").innerText();
	const won = title.includes("OPENAI")
		? { mint: STOCKS.OPENAI, amount: OPENAI_AMOUNT }
		: { mint: STOCKS.SPACEX, amount: SPACEX_AMOUNT };
	const before = await tokenBalance(series.client, owner, won.mint);

	await card.getByRole("button", { name: "Claim to wallet" }).click();
	await expect(page.getByTestId("prize-state")).toHaveText(
		"Delivered to your wallet.",
		{ timeout: 30_000 },
	);
	expect(await tokenBalance(series.client, owner, won.mint)).toBe(
		before + won.amount,
	);
}

async function claimAndVerify(
	page: Page,
	series: Awaited<ReturnType<typeof createSeries>>,
	owner: Parameters<typeof tokenBalance>[1],
) {
	const card = page.getByTestId("prize-card");
	const title = await card.getByRole("heading").innerText();
	const won = title.includes("OPENAI")
		? { mint: STOCKS.OPENAI, amount: OPENAI_AMOUNT }
		: { mint: STOCKS.SPACEX, amount: SPACEX_AMOUNT };
	const before = await tokenBalance(series.client, owner, won.mint);
	const claim = card.getByRole("button", { name: "Claim to wallet" });

	await expect(card).toContainText(
		"Not shares; no ownership, voting or dividend rights.",
	);
	// Token prizes stay locked until the winner self-certifies eligibility.
	await expect(claim).toBeDisabled();
	await expect(card).toContainText("you can't claim it");
	await card.getByRole("checkbox", { name: /I am 18 or older/ }).check();
	await claim.click();
	await expect(page.getByTestId("prize-state")).toHaveText(
		"Delivered to your wallet.",
		{ timeout: 30_000 },
	);
	await expect(page.getByTestId("announcer")).toContainText(
		"delivered to your wallet",
	);
	expect(await tokenBalance(series.client, owner, won.mint)).toBe(
		before + won.amount,
	);

	return won;
}

test("landing explains the series before a treasury is configured", async ({ page }) => {
	const errors = watchErrors(page);

	await page.goto("/");
	await expect(page.getByRole("heading", { level: 1 })).toContainText(
		"pre-IPO exposure",
	);
	await expect(
		page.getByRole("list", { name: "Planned prizes" }).getByRole(
			"listitem",
		),
	).toHaveCount(9);
	await expect(page.getByText("Empty box ×13")).toBeVisible();
	await expect(page.getByTestId("countdown")).toHaveText(
		"Date to be announced",
	);
	await expect(page.getByTestId("no-wallets")).toBeVisible();
	await expect(page.getByRole("heading", { name: "Read before you open" }))
		.toBeVisible();

	for (
		const phrase of [
			"Prizes are PreStocks tokens, not shares.",
			"issuer-controlled tokens",
			"Eligibility and geo-restrictions apply.",
			"Not investment advice",
			"Randomness is verifiable",
		]
	) {
		await expect(page.getByText(phrase)).toBeVisible();
	}

	await expect(page.getByTestId("not-affiliated")).toHaveText(
		"Not affiliated with or endorsed by Anduril, Anthropic, Figure AI, Kalshi, Neuralink, OpenAI, Polymarket or SpaceX.",
	);
	await expect(page.getByRole("link", { name: "Rules", exact: true }))
		.toBeVisible();
	await expect(
		page.getByText("no purchase necessary", { exact: false }).first(),
	)
		.toBeVisible();
	await page.getByRole("button", { name: /Chest\. Press to see why/ }).click();
	await expect(page.getByRole("status").filter({ hasText: "goes live soon" }))
		.toBeVisible();
	await expectAccessible(page);
	expect(
		await page.evaluate(() =>
			document.documentElement.scrollWidth > window.innerWidth
		),
	).toBe(false);
	expect(errors).toEqual([]);
});

test("shows live odds, balance, sends a box, and blocks opening before reveal", async ({ page }) => {
	test.setTimeout(180_000);

	const errors = watchErrors(page);
	const { series } = await openSeries(page, { revealed: false });

	await expect(page.getByTestId("odds-0")).toHaveText("33.3%");
	await expect(page.getByTestId("odds-1")).toHaveText("66.7%");
	await expect(page.getByTestId("copies-0")).toHaveText("1/1");
	await expect(page.getByTestId("copies-1")).toHaveText("2/2");
	await expect(page.getByText("OPENAI · tracks OpenAI")).toBeVisible();
	await expect(page.locator('svg.monogram[data-symbol="OPENAI"]')).toHaveCount(
		1,
	);
	// No company logos anywhere: only ticker monograms.
	await expect(page.locator('img[src*="logos"]')).toHaveCount(0);
	await expect(page.getByTestId("countdown")).toHaveText(
		/^[0-5]h \d{2}m \d{2}s$/,
	);

	await connect(page);
	await expect(page.getByTestId("box-balance")).toHaveText("3");
	await expectAccessible(page);

	await page.getByRole("button", { name: /Chest\. Press to see why/ }).click();
	await expect(page.getByRole("status").filter({ hasText: "Not yet!" }))
		.toBeVisible();
	await expect(chest(page)).toHaveAttribute("data-phase", "idle");

	const friend = await generateKeyPairSigner();

	await page.getByLabel("Friend's Solana address").fill(friend.address);
	await page.getByLabel("Boxes", { exact: true }).fill("1");
	await page.getByRole("button", { name: "Send", exact: true }).click();
	await expect(page.getByText("Sent.")).toBeVisible({ timeout: 20_000 });
	await expect(page.getByTestId("box-balance")).toHaveText("2");
	expect(await series.client.boxBalance(friend.address, series.boxMint)).toBe(
		1n,
	);

	await page.getByLabel("Friend's Solana address").fill("not-an-address");
	await page.getByRole("button", { name: "Send", exact: true }).click();
	await expect(page.getByText("Enter a valid Solana address.")).toBeVisible();
	expect(errors).toEqual([]);
});

test("hold to open charges, reveals the recorded prize, and claims it", async ({ page }) => {
	test.setTimeout(180_000);

	const errors = watchErrors(page);
	const { wallet, series } = await openSeries(page, { revealed: true });

	await expect(page.getByTestId("countdown")).toHaveText("Open now");
	await connect(page);
	await expect(page.getByTestId("box-balance")).toHaveText("3");

	// A short press that is released early drains the charge without opening.
	const target = page.getByRole("button", {
		name: "Press and hold to open a box",
	});
	await target.scrollIntoViewIfNeeded();

	const box = await target.boundingBox();

	if (!box) throw new Error("chest is not visible");

	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await expect(chest(page)).toHaveAttribute("data-phase", "charging");
	await page.mouse.up();
	await expect(chest(page)).toHaveAttribute("data-phase", "idle");
	await expect(page.getByTestId("box-balance")).toHaveText("3");

	await holdChest(page);
	await expect(page.getByTestId("announcer")).toContainText(
		"Recorded on-chain",
		{ timeout: 30_000 },
	);
	await expect(chest(page)).toHaveAttribute(
		"data-reaction",
		/big-prize|small-prize/,
	);
	await expect(page.getByTestId("chest-video")).toBeAttached();
	await expect(page.getByTestId("prize-card")).toBeVisible({ timeout: 20_000 });
	await expect(page.getByTestId("box-balance")).toHaveText("2");

	const won = await claimAndVerify(page, series, wallet.address);
	const reaction = won.mint === STOCKS.OPENAI ? "big-prize" : "small-prize";

	await expect(chest(page)).toHaveAttribute("data-reaction", reaction);
	await expect(
		page.getByTestId(won.mint === STOCKS.OPENAI ? "copies-0" : "copies-1"),
	)
		.toHaveText(won.mint === STOCKS.OPENAI ? "0/1" : "1/2");
	await expect(
		page.getByRole("link", { name: "View opening receipt" }),
	).toHaveAttribute("href", /explorer\.solana\.com\/address\//);
	await expectAccessible(page);
	expect(errors).toEqual([]);
});

test("keyboard hold with reduced motion reveals without the clip", async ({ page }) => {
	test.setTimeout(180_000);

	const errors = watchErrors(page);

	await page.emulateMedia({ reducedMotion: "reduce" });

	const { wallet, series } = await openSeries(page, { revealed: true });

	await connect(page);
	await expect(page.getByTestId("box-balance")).toHaveText("3");

	const target = page.getByRole("button", {
		name: "Press and hold to open a box",
	});

	await target.focus();
	await page.keyboard.down("Space");
	await expect(chest(page)).toHaveAttribute(
		"data-phase",
		/burning|rolling|revealed/,
	);
	await page.keyboard.up("Space");
	await expect(page.getByTestId("prize-card")).toBeVisible({ timeout: 30_000 });
	await expect(page.getByTestId("chest-video")).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Skip animation" }))
		.toHaveCount(0);
	await claimAndVerify(page, series, wallet.address);
	expect(errors).toEqual([]);
});

test("plain open button and skip animation", async ({ page }) => {
	test.setTimeout(180_000);

	const errors = watchErrors(page);
	const { wallet, series } = await openSeries(page, { revealed: true });

	// Hold the clip download so the reveal stays on screen until skipped.
	await page.route("**/animations/cartoon-chest/*.{webm,mp4}", () => {});
	await connect(page);
	await page.getByRole("button", { name: "Open without holding" }).click();
	await expect(page.getByRole("button", { name: "Skip animation" }))
		.toBeVisible({ timeout: 30_000 });
	await expect(page.getByTestId("prize-card")).toHaveCount(0);
	await page.getByRole("button", { name: "Skip animation" }).click();
	await expect(page.getByTestId("prize-card")).toBeVisible();
	await expect(chest(page)).toHaveAttribute("data-phase", "revealed");
	await claimAndVerify(page, series, wallet.address);
	expect(errors).toEqual([]);
});

test("an oracle outage is recoverable and never burns a second box", async ({ page }) => {
	test.setTimeout(180_000);

	// The aborted proof requests surface as network errors by design.
	const errors = watchErrors(page, [/Failed to load resource|ERR_FAILED/]);
	const { wallet, series } = await openSeries(page, { revealed: true });

	await page.route(`${CONTROL}/proof?*`, (route) => route.abort());
	await connect(page);
	await page.getByRole("button", { name: "Open without holding" }).click();
	await expect(chest(page)).toHaveAttribute("data-phase", "failed", {
		timeout: 30_000,
	});
	await expect(page.getByText(/oracle has not revealed yet/).first())
		.toBeVisible();
	await expect(page.getByTestId("box-balance")).toHaveText("2");

	// Reload: the unfinished opening is recovered from chain, not local state.
	await page.unroute(`${CONTROL}/proof?*`);
	await page.reload();
	await connect(page);
	await expect(page.getByTestId("box-balance")).toHaveText("2");
	await page.getByRole("button", { name: "Resume unfinished opening" }).click();
	await finishReveal(page);
	await expect(page.getByTestId("box-balance")).toHaveText("2");
	await claimAndVerify(page, series, wallet.address);
	expect(errors).toEqual([]);
});

test("an empty box plays the disappointed reaction and still delivers the badge and SOL", async ({ page }) => {
	test.setTimeout(180_000);

	const errors = watchErrors(page);
	const { wallet, series } = await openSeries(page, {
		revealed: true,
		kind: "empty",
	});

	await expect(page.getByText("Empty box ×3")).toBeVisible();
	await expect(page.getByTestId("odds-0")).toHaveText("100%");
	await connect(page);
	await expect(page.getByTestId("box-balance")).toHaveText("3");
	await holdChest(page);
	await expect(page.getByTestId("announcer")).toContainText(
		"an empty box",
		{ timeout: 30_000 },
	);
	await expect(chest(page)).toHaveAttribute("data-reaction", "disappointed");
	await finishReveal(page);

	const card = page.getByTestId("prize-card");

	await expect(card.getByRole("heading")).toHaveText(
		"Empty box — you kept the chest",
	);
	await expect(card).toContainText("Empty Box badge");
	await expect(card).toContainText("0.001 SOL");

	const badge = series.badge;

	if (!badge) throw new Error("empty series has no badge");

	const lamportsBefore = (await series.client.rpc.getBalance(wallet.address, {
		commitment: "processed",
	}).send()).value;

	await card.getByRole("button", { name: "Claim to wallet" }).click();
	await expect(page.getByTestId("prize-state")).toHaveText(
		"Delivered to your wallet.",
		{ timeout: 30_000 },
	);
	expect(await tokenBalance(series.client, wallet.address, badge)).toBe(1n);

	const lamportsAfter = (await series.client.rpc.getBalance(wallet.address, {
		commitment: "processed",
	}).send()).value;

	// The claimer pays about 0.00204 SOL badge-account rent plus fees. Without
	// the 0.001 SOL asset the change would be below -0.002 SOL.
	expect(lamportsAfter - lamportsBefore).toBeGreaterThan(-1_500_000n);
	await expect(chest(page)).toHaveAttribute("data-reaction", "disappointed");
	await expectAccessible(page);
	expect(errors).toEqual([]);
});

test("the eligibility gate blocks a token claim until the winner certifies", async ({ page }) => {
	test.setTimeout(180_000);

	const errors = watchErrors(page);
	const { wallet, series } = await openSeries(page, { revealed: true });

	await connect(page);
	await page.getByRole("button", { name: "Open without holding" }).click();
	await finishReveal(page);

	const card = page.getByTestId("prize-card");
	const claim = card.getByRole("button", { name: "Claim to wallet" });
	const gate = card.getByRole("checkbox", { name: /I am 18 or older/ });

	await expect(claim).toBeDisabled();
	await expect(card).toContainText(
		"If you can't confirm all of this, you can't claim it",
	);
	await gate.check();
	await expect(claim).toBeEnabled();
	await gate.uncheck();
	await expect(claim).toBeDisabled();
	await expect(card.getByRole("link", { name: "official rules" }))
		.toHaveAttribute("href", /\/rules\?treasury=/);
	await expectAccessible(page);
	await gate.check();
	await claimAndVerifyCertified(page, series, wallet.address);
	expect(errors).toEqual([]);
});

test("the official rules read dates, inventory and odds from chain", async ({ page }) => {
	test.setTimeout(180_000);

	const errors = watchErrors(page);
	const { series } = await openSeries(page, { revealed: false });

	await page.getByRole("link", { name: "Rules", exact: true }).click();
	await expect(page).toHaveURL(
		new RegExp(`/rules\\?treasury=${series.treasury}`),
	);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"Official rules",
	);

	for (
		const heading of [
			"1. Promoter",
			"2. Free entry",
			"3. Eligibility",
			"4. Dates",
			"5. Prizes, inventory and odds",
			"6. How prizes are allocated",
			"7. Delivery",
			"8. Public verification",
			"9. Taxes, risk and advice",
		]
	) {
		await expect(page.getByRole("heading", { name: heading })).toBeVisible();
	}

	await expect(page.getByTestId("rules-reveal")).not.toHaveText(
		"to be announced",
	);
	await expect(page.getByTestId("odds-0")).toHaveText("33.3%");
	await expect(page.getByTestId("odds-1")).toHaveText("66.7%");
	await expect(page.getByText(/PreStocks tokens exclude US persons/))
		.toBeVisible();
	await expect(
		page.getByText("Backed xStocks exclude UK clients", { exact: false }),
	)
		.toBeVisible();
	await expect(page.getByRole("link", { name: "treasury account" }))
		.toHaveAttribute("href", /explorer\.solana\.com\/address\//);
	await expectAccessible(page);
	expect(
		await page.evaluate(() =>
			document.documentElement.scrollWidth > window.innerWidth
		),
	).toBe(false);
	expect(errors).toEqual([]);
});
