import { expect, test } from "@playwright/test";

test("opens and redeems the first lootbox", async ({ page }) => {
	await page.goto("/");
	const openButton = page.getByRole("button", { name: /crack the seal/i });

	await expect(openButton).toBeEnabled();
	await openButton.click();
	await expect(page.getByTestId("inventory-count")).toHaveText("2");
	await expect(page.getByTestId("reward-card")).toContainText("Solar Crown");
	await expect(page.getByTestId("reward-card")).toContainText("0.050 SOL");

	await page.getByRole("button", { name: /redeem reward/i }).click();
	await expect(page.getByTestId("wallet-balance")).toHaveText("0.050 SOL");
	await expect(page.getByText("REDEMPTION COMPLETE")).toBeVisible();
});

test("explains the on-chain safety model", async ({ page }) => {
	await page.goto("/");

	await expect(page.getByText("Switchboard ABI")).toBeVisible();
	await expect(page.getByText("Burn before reveal")).toBeVisible();
	await expect(page.getByText("Fully collateralized")).toBeVisible();
	await expect(page.getByText("Bias-free selection")).toBeVisible();
});
