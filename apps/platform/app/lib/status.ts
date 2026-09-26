/**
 * One short status for a lootbox, shared by cards, the page hero, and tabs.
 */
import type { TemplateStatus } from "./chain.js";

export type StatusTone = "setup" | "sealed" | "open" | "done";

export type LootboxStatus = Readonly<{ tone: StatusTone; label: string }>;

/** "3d 4h", "2h 5m", "45s": the two largest units. */
export function formatDuration(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const units: [number, string][] = [
		[86_400, "d"],
		[3_600, "h"],
		[60, "m"],
		[1, "s"],
	];
	const parts: string[] = [];
	let rest = total;

	for (const [size, suffix] of units) {
		if (parts.length === 2) break;

		const value = Math.floor(rest / size);

		if (value > 0 || (parts.length === 0 && size === 1)) {
			parts.push(`${value}${suffix}`);
			rest -= value * size;
		} else if (parts.length > 0) {
			break;
		}
	}

	return parts.join(" ");
}

export function lootboxStatus(
	summary: Readonly<{
		status: TemplateStatus;
		lockedAt: number;
		opensAt: number;
		chainTime: number;
		remaining: string;
	}>,
): LootboxStatus {
	if (summary.lockedAt === 0) {
		return summary.status === "retired"
			? { tone: "done", label: "Retired" }
			: { tone: "setup", label: "Being filled" };
	}

	if (BigInt(summary.remaining) === 0n) {
		return { tone: "done", label: "All opened" };
	}

	if (summary.chainTime < summary.opensAt) {
		return {
			tone: "sealed",
			label: `Opens in ${formatDuration(summary.opensAt - summary.chainTime)}`,
		};
	}

	return { tone: "open", label: "Open now" };
}

export const ACCENT_COLORS: Readonly<
	Record<string, readonly [string, string]>
> = {
	teal: ["#146f63", "#d3ece7"],
	gold: ["#8a5f00", "#f8e7b0"],
	coral: ["#b23a31", "#f6d6d1"],
	plum: ["#6b3fa0", "#e6daf3"],
	ink: ["#1d1a14", "#e2dccb"],
};

/** CSS custom properties for a lootbox's accent colour. */
export function accentStyle(accent: string): Record<string, string> {
	const [strong, soft] = ACCENT_COLORS[accent] ?? ACCENT_COLORS["teal"] ??
		["#146f63", "#d3ece7"];

	return { "--accent": strong, "--accent-soft": soft };
}
