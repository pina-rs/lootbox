import { expect, test } from "@playwright/test";
import {
	address,
	createSolanaRpc,
	getAddressDecoder,
	getBase64Encoder,
} from "@solana/kit";

test("funds a real Surfpool treasury, gifts boxes, and delivers every bundle", async ({ page }) => {
	test.setTimeout(180_000);
	if (test.info().project.name === "mobile") {
		await page.emulateMedia({ reducedMotion: "reduce" });
	}
	await page.goto("/");
	await expect(page.getByText("SURFPOOL · LOCAL", { exact: true }))
		.toBeVisible();
	await page.getByRole("button", { name: "Workshop", exact: true }).click();
	await page.getByLabel("Template name", { exact: true }).fill(
		`Browser ${test.info().project.name}`,
	);
	const copies = page.getByLabel("Copies", { exact: true });
	await copies.nth(0).fill("1");
	await copies.nth(1).fill("1");
	await page.getByRole("button", { name: "Fund treasury & seal" }).click();
	await expect(
		page.getByText("Treasury funded and sealed. Mint your first gift below."),
	).toBeVisible({ timeout: 60_000 });
	await page.getByLabel("Boxes", { exact: true }).fill("3");
	await page.getByRole("button", { name: "Mint a gift", exact: true }).click();
	await expect(page.getByTestId("box-balance")).toHaveText("3", {
		timeout: 20_000,
	});
	const recipient = address(
		await page.getByLabel("Recipient address", { exact: true }).inputValue(),
	);
	const configResponse = await page.request.get("http://127.0.0.1:8898/config");
	const config: { rpcUrl: string } = await configResponse.json();
	const rpc = createSolanaRpc(config.rpcUrl);
	const before =
		(await rpc.getBalance(recipient, { commitment: "processed" }).send()).value;
	const prizes: string[] = [];
	for (let index = 0; index < 3; index++) {
		if (index === 0) {
			await page.route(
				"http://127.0.0.1:8898/proof?*",
				(route) => route.abort(),
				{ times: 1 },
			);
		}
		await page.getByRole("region", { name: "Gift workspace" }).getByRole(
			"button",
			{ name: index ? "Open another gift" : "Open a gift", exact: true },
		).click();
		if (index === 0) {
			await expect(page.getByRole("button", { name: "Resume opening" }))
				.toBeEnabled();
			await page.reload();
			await page.getByRole("button", { name: "Resume opening" }).click();
		}
		await expect(page.getByRole("button", { name: "Reveal your winnings" }))
			.toBeEnabled({ timeout: 30_000 });
		await expect(page.getByTestId("box-balance")).toHaveText(String(2 - index));
		if (index === 0) {
			await page.reload();
			await expect(page.getByRole("button", { name: "Reveal your winnings" }))
				.toBeEnabled();
		}
		await page.getByRole("button", { name: "Reveal your winnings" }).click();
		await expect(page.getByTestId("prize-announcement")).toContainText(
			"Not yet claimed. Choose Claim your winnings",
		);
		await expect(page.getByTestId("prize-announcement")).toHaveAttribute(
			"aria-live",
			"polite",
		);
		prizes.push(
			await page.getByTestId("prize-reveal").getByRole("heading").innerText(),
		);
		await page.getByRole("button", { name: "Claim your winnings" }).click();
		await expect(page.getByRole("heading", { name: "Cargo secured." }))
			.toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId("lootbox-machine")).toHaveAttribute(
			"data-phase",
			"redeemed",
		);
	}
	expect(prizes.sort()).toEqual(
		["0.1 SOL", "1 SOL + 2 exclusive NFTs", "100 tokens"].sort(),
	);
	const after =
		(await rpc.getBalance(recipient, { commitment: "processed" }).send()).value;
	// Both SOL prizes arrived, net of real test-network rent and fees.
	expect(after - before).toBeGreaterThan(1_000_000_000n);
	expect(after - before).toBeLessThan(1_100_000_000n);
	const accounts = await rpc.getTokenAccountsByOwner(recipient, {
		programId: address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
	}, { commitment: "processed", encoding: "base64" }).send();
	const amounts = accounts.value.map((account) =>
		new DataView(
			Uint8Array.from(getBase64Encoder().encode(account.account.data[0]))
				.buffer,
		).getBigUint64(64, true)
	);
	expect(amounts.sort((a, b) => a < b ? -1 : 1)).toEqual([1n, 1n, 100n]);
	await expect(page.getByRole("button", { name: "Mint a gift", exact: true }))
		.toBeDisabled();
	await page.reload();
	await expect(page.getByTestId("box-balance")).toHaveText("0");
	await expect(page.getByRole("heading", { name: "Cargo secured." }))
		.toBeVisible();
	expect(
		await page.evaluate(() =>
			document.documentElement.scrollWidth > window.innerWidth
		),
	).toBe(false);
});

test("resumes partially funded drafts and transfers a time-locked gift", async ({ page }) => {
	test.setTimeout(120_000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/");
	await expect(page.getByText("SURFPOOL · LOCAL", { exact: true }))
		.toBeVisible();
	await page.getByRole("button", { name: "Workshop", exact: true }).click();
	await page.getByLabel("Template name", { exact: true }).fill(
		`Time capsule ${test.info().project.name}`,
	);
	const unlock = new Date(Date.now() + 3_600_000);
	// datetime-local uses browser-local wall time, not a UTC-suffixed string.
	const localDate = new Date(
		unlock.getTime() - unlock.getTimezoneOffset() * 60_000,
	).toISOString().slice(0, 16);
	await page.getByLabel(/Earliest claim date/).fill(localDate);
	const prizeTypes = page.getByRole("combobox", { name: "Prize", exact: true });
	await expect(prizeTypes).toHaveCount(3);
	for (let index = 0; index < 3; index++) {
		await prizeTypes.nth(index).selectOption("sol");
	}
	for (
		const quantity of await page.getByLabel("Copies", { exact: true }).all()
	) await quantity.fill("1");
	for (
		const amount of await page.getByLabel("SOL / win", { exact: true }).all()
	) await amount.fill("40");
	await page.getByRole("button", { name: "Fund treasury & seal" }).click();
	await expect(page.getByRole("alert")).toBeVisible({ timeout: 40_000 });
	await expect(page.getByRole("button", { name: "Resume funding & seal" }))
		.toBeEnabled();
	await page.reload();
	await expect(page.getByLabel("Template name", { exact: true }))
		.toBeDisabled();
	await page.getByRole("button", { name: "Reset creator test SOL" }).click();
	await expect(
		page.getByText("Creator reset to 100 test SOL. Resume funding when ready."),
	).toBeVisible();
	await page.getByRole("button", { name: "Resume funding & seal" }).click();
	await expect(
		page.getByText("Treasury funded and sealed. Mint your first gift below."),
	).toBeVisible({ timeout: 40_000 });
	await page.getByRole("button", { name: "Mint a gift", exact: true }).click();
	await expect(page.getByTestId("box-balance")).toHaveText("1");
	await expect(
		page.getByRole("button", { name: "Waiting for the unlock date" }),
	).toBeDisabled();
	const response = await page.request.get("http://127.0.0.1:8898/config");
	const config: { rpcUrl: string } = await response.json();
	const rpc = createSolanaRpc(config.rpcUrl);
	const template = address(
		await page.getByLabel("Choose template").inputValue(),
	);
	const account = await rpc.getAccountInfo(template, {
		commitment: "processed",
		encoding: "base64",
	}).send();
	if (!account.value) throw new Error("Template missing after creation");
	const creator = getAddressDecoder().decode(
		getBase64Encoder().encode(account.value.data[0]).slice(1, 33),
	);
	await page.getByLabel("Recipient address", { exact: true }).fill(creator);
	await page.getByText("Transfer gifts you already hold", { exact: true })
		.click();
	await page.getByRole("button", { name: "Transfer to address above" }).click();
	await expect(page.getByTestId("box-balance")).toHaveText("0");
	await expect(page.getByText("Sealed gifts transferred", { exact: true }))
		.toBeVisible();
});

test("explains creator validation beside the affected fields", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByText("SURFPOOL · LOCAL", { exact: true }))
		.toBeVisible();
	await page.getByRole("button", { name: "Workshop", exact: true }).click();
	await page.getByLabel("Template name", { exact: true }).fill("🎁".repeat(9));
	await expect(page.getByLabel("Template name", { exact: true }))
		.toHaveAttribute("aria-invalid", "true");
	await expect(page.getByLabel("Template name", { exact: true }))
		.toHaveAccessibleDescription(/32 UTF-8 bytes/);
	await page.getByLabel("SOL / win", { exact: true }).fill("invalid");
	await expect(page.getByLabel("SOL / win", { exact: true }))
		.toHaveAccessibleDescription(/positive decimal amount/);
	await page.getByLabel("Weight", { exact: true }).nth(0).fill("1001");
	await expect(page.getByLabel("Weight", { exact: true }).nth(0))
		.toHaveAccessibleDescription(/1 to 1,000/);
	await expect(page.getByRole("button", { name: "Fund treasury & seal" }))
		.toBeDisabled();
	await expect(page.getByText(/Funding is unavailable/)).toBeVisible();
	await page.getByLabel("Template name", { exact: true }).fill("Valid draft");
	await page.getByLabel("SOL / win", { exact: true }).fill("0.1");
	await page.getByLabel("Weight", { exact: true }).nth(0).fill("1");
	await expect(page.getByRole("button", { name: "Fund treasury & seal" }))
		.toBeEnabled();
	expect(
		await page.evaluate(() =>
			document.documentElement.scrollWidth > innerWidth
		),
	).toBe(false);
});

test("shows an actionable offline state instead of simulated balances", async ({ page }) => {
	await page.route("http://127.0.0.1:8898/config", (route) => route.abort());
	await page.goto("/");
	await expect(page.getByRole("alert")).toBeVisible();
	await expect(page.getByRole("button", { name: "Retry connection" }))
		.toBeEnabled();
	await expect(page.getByRole("button", { name: "Build your first drop" }))
		.toBeDisabled();
});
