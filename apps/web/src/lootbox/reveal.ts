export type RevealOutcome = "big-prize" | "small-prize" | "disappointed";

/** Wishes change the presentation only; the recorded bundle is authoritative. */
export function revealOutcome(
	selectedBundle: string,
	wish: string,
): RevealOutcome {
	return wish === ""
		? "small-prize"
		: selectedBundle === wish
		? "big-prize"
		: "disappointed";
}

export const revealAnimations: Record<RevealOutcome, string> = {
	"big-prize": "Big prize",
	"small-prize": "Small prize",
	disappointed: "Disappointed",
};
