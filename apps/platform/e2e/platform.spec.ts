/**
 * The whole product on local Surfpool: a creator launches a lootbox through
 * the wizard, edits it, locks it, and sends boxes; a friend opens one after
 * the reveal date and claims the prize; the cron relayer finishes an opening
 * its holder abandoned.
 *
 * Real boundaries: the Worker (React Router SSR, D1, R2, cron) in Miniflare,
 * the SBF lootbox program, SIWS verification, and every transaction. Replaced
 * boundaries: the wallet (a Wallet Standard test wallet signing with a local
 * keypair) and the oracle (the Surfpool Switchboard emulator).
 */
import AxeBuilder from "@axe-core/playwright";
import {
	fetchTemplateOpeningState,
	listTemplateOpenings,
	LootboxClient,
} from "@pina-rs/lootbox";
import { expect, type Page, test } from "@playwright/test";
import { address, type KeyPairSigner } from "@solana/kit";

import {
	chainTime,
	controlConfig,
	fundedSigner,
	injectTestWallet,
	testToken,
	timeTravel,
} from "./support/localnet.js";

test.describe.configure({ mode: "serial" });

const PROJECT_SUFFIX = () =>
	Math.random().toString(36).slice(2, 6).toUpperCase();

async function expectAccessible(page: Page, label: string) {
	const results = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa"])
		.analyze();

	expect(
		results.violations,
		`${label}: ${
			JSON.stringify(results.violations.map((v) => [v.id, v.nodes[0]?.target]))
		}`,
	)
		.toEqual([]);
}

/** Save a screenshot when LOOTBOX_SCREENSHOTS is set (for design review). */
async function snap(page: Page, name: string) {
	const directory = process.env.LOOTBOX_SCREENSHOTS;

	if (!directory) return;

	const project = test.info().project.name;

	await page.screenshot({
		path: `${directory}/${project}-${name}.png`,
		fullPage: true,
	});
}

function collectConsoleErrors(page: Page): string[] {
	const errors: string[] = [];

	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	page.on("pageerror", (error) => errors.push(error.message));

	return errors;
}

async function connectAndSignIn(page: Page) {
	await page.getByRole("button", { name: "Connect wallet" }).first().click();
	await page.getByRole("button", { name: /E2E Wallet/ }).click();
	await page.getByRole("button", { name: "Sign in with wallet" }).click();
}

let creator: KeyPairSigner;
let friend: KeyPairSigner;
let rpcUrl: string;
let token: string;
let slug: string;
let template: string;
let boxMint: string;
const name = `Treasure ${PROJECT_SUFFIX()}`;

test.beforeAll(async () => {
	({ rpcUrl } = await controlConfig());
	creator = await fundedSigner();
	friend = await fundedSigner();
	token = await testToken(
		new LootboxClient(rpcUrl, creator),
		rpcUrl,
		creator,
		1_000_000_000n,
	);
});

test("home and explore are accessible", async ({ page }) => {
	const errors = collectConsoleErrors(page);

	await page.goto("/");
	await expect(page.getByRole("heading", { level: 1 })).toContainText(
		"real prizes",
	);
	await expectAccessible(page, "home");
	await snap(page, "01-home");
	await page.getByRole("link", { name: "Explore", exact: true }).click();
	await expect(page).toHaveURL(/\/explore$/);
	await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
	await expectAccessible(page, "explore");
	expect(errors).toEqual([]);
});

test("a creator launches a lootbox through the wizard", async ({ page }) => {
	const errors = collectConsoleErrors(page);

	await injectTestWallet(page, creator);
	await page.goto("/create");
	await connectAndSignIn(page);

	// 1. Details
	await expect(page.getByRole("heading", { name: "Details" })).toBeVisible();
	await page.getByLabel("Name").fill(name);
	await expect(page.getByLabel("Symbol")).toHaveValue("TREASURE");
	await page.getByLabel("Description").fill(
		"A **test** lootbox on local Surfpool.",
	);
	await page.getByRole("button", { name: "Tomorrow" }).click();
	await expect(page.getByText(/Opens \d+h|Opens 1d/)).toBeVisible();
	await expectAccessible(page, "wizard details");
	await snap(page, "02-create-details");
	await page.getByRole("button", { name: "Next" }).click();

	// 2. Prizes: a rare SOL bundle and a common token bundle.
	await expect(page.getByRole("heading", { name: "Prizes" })).toBeVisible();
	await page.getByRole("button", { name: "+ Add a bundle" }).click();
	const grand = page.getByRole("region", { name: /Bundle 1/ });

	await grand.getByRole("button", { name: "+ Add prize" }).click();
	await grand.getByLabel("SOL per box").fill("0.5");
	await grand.getByRole("button", { name: "Add SOL" }).click();
	await expect(grand.getByText("0.5 SOL")).toBeVisible();

	await page.getByRole("button", { name: "+ Add a bundle" }).click();
	const common = page.getByRole("region", { name: /Bundle 2/ });

	await common.getByLabel("Bundle name").fill("Token pile");
	await common.getByLabel("Boxes").fill("3");
	await common.getByRole("button", { name: "+ Add prize" }).click();
	await common.getByText("Token", { exact: true }).click();
	await common.getByRole("button", { name: new RegExp(token.slice(0, 4)) })
		.click();
	await common.getByLabel("Amount per box").fill("10");
	await common.getByRole("button", { name: "Add token" }).click();
	await expect(common.getByText(/^10 tokens/)).toBeVisible();

	const preview = page.getByTestId("odds-preview");

	await expect(preview).toContainText("25%");
	await expect(preview).toContainText("75%");
	await snap(page, "03-create-prizes");
	await page.getByRole("button", { name: "Next" }).click();

	// 3. Exclusive Lootbox NFTs are behind a flag until the program ships them.
	await expect(page.getByTestId("exclusive-unavailable")).toBeVisible();
	await snap(page, "04-create-exclusive");
	await page.getByRole("button", { name: "Review" }).click();

	// 4. Review
	await expect(page.getByTestId("cost-total")).toContainText("SOL");
	await expect(page.getByTestId("review-odds")).toContainText("Token pile");
	await expectAccessible(page, "wizard review");
	await snap(page, "05-create-review");
	await page.getByRole("button", { name: "Continue to launch" }).click();

	// 5. Launch
	await page.getByRole("button", { name: "Launch lootbox" }).click();
	await page.waitForURL(/\/l\/treasure-/, { timeout: 120_000 });
	slug = new URL(page.url()).pathname.split("/")[2] ?? "";

	await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
	await expect(page.getByTestId("status")).toHaveText("Being filled");
	await expect(page.getByTestId("odds-table")).toContainText("Token pile");
	await snap(page, "06-live-page");
	expect(errors).toEqual([]);
});

test("the creator edits the page, locks, and sends a box", async ({ page }) => {
	const errors = collectConsoleErrors(page);

	await injectTestWallet(page, creator);
	await page.goto(`/l/${slug}`);
	await page.getByRole("button", { name: "Connect wallet" }).click();
	await page.getByRole("button", { name: /E2E Wallet/ }).click();
	await page.getByRole("navigation", { name: "Lootbox sections" }).getByRole(
		"link",
		{ name: "Manage" },
	).click();
	await expect(page).toHaveURL(new RegExp(`/l/${slug}/manage$`));
	await page.getByRole("button", { name: "Sign in with wallet" }).click();

	// Display edits are D1-only and show up everywhere at once.
	await page.getByLabel("Tagline").fill("Shiny things for testers");
	await page.getByRole("button", { name: "Save changes" }).click();
	await expect(page.getByText("Saved.")).toBeVisible();
	await expect(page.locator(".lootbox-title .lede")).toHaveText(
		"Shiny things for testers",
	);
	await expectAccessible(page, "manage");

	const lockState = page.getByTestId("lock-state");

	await expect(lockState).toHaveText("Live, not locked");
	await page.getByLabel(/locking is permanent/).check();
	await page.getByRole("button", { name: /Lock and mint 4 boxes/ }).click();
	await expect(lockState).toHaveText("Locked", { timeout: 60_000 });
	await expect(page.getByTestId("supply")).toHaveText("4");

	await page.getByLabel("Recipients").fill(`${friend.address} 2`);
	await page.getByRole("button", { name: "Send 2 boxes" }).click();
	await expect(page.getByTestId("sent")).toHaveText("Sent 2 boxes.", {
		timeout: 60_000,
	});
	await snap(page, "07-manage");
	expect(errors).toEqual([]);
});

test("rules tab navigation, metadata, and explore listing", async ({ page, request }) => {
	await page.goto(`/l/${slug}`);
	await page.getByRole("navigation", { name: "Lootbox sections" }).getByRole(
		"link",
		{ name: "Rules" },
	).click();
	await expect(page).toHaveURL(new RegExp(`/l/${slug}/rules$`));
	await expect(page.getByRole("heading", { name: "1. Organizer" }))
		.toBeVisible();
	await expect(page.getByTestId("rules-reveal")).not.toHaveText(
		"to be announced",
	);
	await expectAccessible(page, "rules");
	await snap(page, "08-rules");

	const treasury = await page.getByRole("link", { name: "treasury account" })
		.getAttribute("href");

	template = treasury?.split("/address/")[1]?.split("?")[0] ?? "";
	boxMint =
		(await page.getByRole("link", { name: "box token" }).getAttribute("href"))
			?.split("/address/")[1]?.split("?")[0] ?? "";

	const metadata: unknown = await (await request.get(`/m/${boxMint}.json`))
		.json();

	expect(metadata).toMatchObject({ name, symbol: "TREASURE" });
	expect(JSON.stringify(metadata)).toContain("Shiny things for testers");

	const card = await request.get(`/og/${slug}.png`);

	expect(card.headers()["content-type"]).toBe("image/png");
	expect([...(await card.body()).subarray(0, 4)]).toEqual([
		0x89,
		0x50,
		0x4e,
		0x47,
	]);
	expect(
		await page.locator('meta[property="og:image"]').getAttribute("content"),
	)
		.toMatch(new RegExp(`/og/${slug}\\.png$`));

	await page.goBack();
	await expect(page).toHaveURL(new RegExp(`/l/${slug}$`));
	await page.getByRole("navigation", { name: "Lootbox sections" }).getByRole(
		"link",
		{ name: "Odds" },
	).click();
	await expect(page.getByTestId("odds-table")).toContainText("Grand prize");
	await page.getByRole("navigation", { name: "Lootbox sections" }).getByRole(
		"link",
		{ name: "Overview" },
	).click();
	await expect(page.getByRole("heading", { name: "What's inside" }))
		.toBeVisible();

	await page.getByRole("link", { name: "Explore", exact: true }).click();
	await expect(page.getByRole("link", { name: new RegExp(name) }))
		.toBeVisible();
	await page.getByRole("link", { name: new RegExp(name) }).click();
	await expect(page).toHaveURL(new RegExp(`/l/${slug}$`));
});

test("the relayer finishes an abandoned opening after the reveal", async ({ request }) => {
	const client = new LootboxClient(rpcUrl, friend);
	const state = await client.template(address(template));

	await timeTravel((await chainTime(client)) + 2n * 86_400n);

	// The friend burns one box from a script and walks away.
	const body: unknown = await (await fetch("http://127.0.0.1:8898/config"))
		.json();
	const oracle = Reflect.get(body as object, "oracle") as Record<
		string,
		string
	>;
	const account = (key: string) => address(oracle[key] ?? "");
	const opening = await client.requestOpen(state, {
		queue: account("queue"),
		oracle: account("oracle"),
		programState: account("programState"),
		lutSigner: account("lutSigner"),
		lut: account("lut"),
		stats: account("stats"),
	});

	expect(opening.data.status).toBe(0);

	// The oracle can reveal only after the committed seed slot has passed.
	await expect.poll(async () =>
		(await client.rpc.getSlot({ commitment: "confirmed" }).send()) >
			opening.data.seedSlot
	).toBe(true);

	// Miniflare's test hook runs the Worker's cron handler once, awaited.
	const response = await request.get(
		"/cdn-cgi/handler/scheduled?cron=*+*+*+*+*",
	);

	expect(response.ok()).toBe(true);

	const settled = await fetchTemplateOpeningState(client.rpc, opening.address, {
		commitment: "processed",
	});

	expect(settled.data.status).toBe(2);
});

test("a friend opens a box after the reveal and claims the prize", async ({ page }) => {
	const errors = collectConsoleErrors(page);

	await injectTestWallet(page, friend);
	await page.goto(`/l/${slug}`);
	await page.getByRole("button", { name: "Connect wallet" }).click();
	await page.getByRole("button", { name: /E2E Wallet/ }).click();

	// One box was opened by the relayer test; its prize waits to be claimed.
	await expect(page.getByTestId("box-balance")).toHaveText("You have 1 box");
	await expect(page.getByRole("heading", { name: "Your unfinished openings" }))
		.toBeVisible();
	await expectAccessible(page, "holder");
	await snap(page, "09-holder");

	await page.getByRole("button", { name: "Open without holding" }).click();
	const card = page.getByTestId("prize-card");

	await expect(card).toBeVisible({ timeout: 60_000 });
	await snap(page, "10-prize");
	await card.getByRole("button", { name: "Claim to wallet" }).click();
	await expect(card.getByText("Delivered to your wallet.")).toBeVisible({
		timeout: 60_000,
	});
	await expect(page.getByTestId("box-balance")).toHaveText("You have 0 boxes");

	const openings = await listTemplateOpenings(
		new LootboxClient(rpcUrl, friend).rpc,
		address(template),
	);
	const mine = openings.filter((item) =>
		item.data.beneficiary === friend.address
	);

	expect(mine.map((item) => item.data.status).sort()).toEqual([2, 3]);
	expect(boxMint).not.toBe("");
	expect(errors).toEqual([]);
});
