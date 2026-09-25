import type { PrizeTier } from "./prizes.js";

/** How long the chest must be held before it commits to opening. */
export const HOLD_TO_OPEN_MS = 1_200;

/** The chest reaction clip that plays once the recorded result is known. */
export type Reaction = "big-prize" | "small-prize";

/** The on-chain result, read back after allocation. */
export type RecordedResult = Readonly<{
	opening: string;
	bundleIndex: number;
	tier: PrizeTier;
	signature: string | null;
}>;

/**
 * Presentation state for one opening.
 *
 * The chain decides the prize. This machine only sequences what the viewer
 * sees: the hold (anticipation), the honest waits for the burn and for the
 * oracle, then a reveal of the already-recorded result and its claim.
 */
export type OpeningState =
	| Readonly<{ phase: "idle" }>
	| Readonly<{ phase: "charging"; startedAt: number }>
	| Readonly<{ phase: "burning" }>
	| Readonly<{ phase: "rolling"; opening: string; signature: string | null }>
	| Readonly<{ phase: "revealing"; result: RecordedResult }>
	| Readonly<{ phase: "revealed"; result: RecordedResult }>
	| Readonly<{ phase: "claiming"; result: RecordedResult }>
	| Readonly<{
		phase: "claimed";
		result: RecordedResult;
		signature: string | null;
	}>
	| Readonly<{
		phase: "failed";
		message: string;
		opening: string | null;
		result: RecordedResult | null;
	}>;

export type OpeningEvent =
	| Readonly<{ type: "hold"; at: number }>
	| Readonly<{ type: "release" }>
	| Readonly<{ type: "charged" }>
	| Readonly<{ type: "committed"; opening: string; signature: string | null }>
	| Readonly<{ type: "recorded"; result: RecordedResult }>
	| Readonly<{ type: "revealFinished" }>
	| Readonly<{ type: "claim" }>
	| Readonly<{ type: "claimed"; signature: string | null }>
	| Readonly<{ type: "fail"; message: string }>
	| Readonly<{ type: "reset" }>;

export const initialOpening: OpeningState = Object.freeze({ phase: "idle" });

function openingOf(state: OpeningState): string | null {
	if (state.phase === "rolling") return state.opening;

	if ("result" in state && state.result) return state.result.opening;

	return null;
}

export function openingReducer(
	state: OpeningState,
	event: OpeningEvent,
): OpeningState {
	switch (event.type) {
		case "hold":
			return state.phase === "idle"
				? { phase: "charging", startedAt: event.at }
				: state;
		case "release":
			return state.phase === "charging" ? initialOpening : state;
		case "charged":
			return state.phase === "charging" || state.phase === "idle"
				? { phase: "burning" }
				: state;
		case "committed":
			return state.phase === "burning" || state.phase === "failed" ||
					state.phase === "idle"
				? {
					phase: "rolling",
					opening: event.opening,
					signature: event.signature,
				}
				: state;
		case "recorded":
			return state.phase === "rolling" || state.phase === "burning" ||
					state.phase === "idle" || state.phase === "failed"
				? { phase: "revealing", result: event.result }
				: state;
		case "revealFinished":
			return state.phase === "revealing"
				? { phase: "revealed", result: state.result }
				: state;
		case "claim":
			if (state.phase === "revealed" || state.phase === "revealing") {
				return { phase: "claiming", result: state.result };
			}

			return state.phase === "failed" && state.result
				? { phase: "claiming", result: state.result }
				: state;
		case "claimed":
			return state.phase === "claiming"
				? {
					phase: "claimed",
					result: state.result,
					signature: event.signature,
				}
				: state;
		case "fail":
			return {
				phase: "failed",
				message: event.message,
				opening: openingOf(state),
				result: "result" in state && state.result ? state.result : null,
			};
		case "reset":
			return initialOpening;
	}
}

/** Charge level from 0 to 1 for a hold that started at `startedAt`. */
export function chargeLevel(startedAt: number, now: number): number {
	const ratio = (now - startedAt) / HOLD_TO_OPEN_MS;

	return Math.min(1, Math.max(0, ratio));
}

export function reactionFor(tier: PrizeTier): Reaction {
	return tier === "headline" ? "big-prize" : "small-prize";
}

/** One sentence for the polite live region. Never depends on the animation. */
export function openingAnnouncement(
	state: OpeningState,
	prizeTitle: (result: RecordedResult) => string,
): string {
	switch (state.phase) {
		case "idle":
			return "";
		case "charging":
			return "Charging the chest. Keep holding.";
		case "burning":
			return "Approve in your wallet to burn one box and commit Switchboard randomness.";
		case "rolling":
			return "Box burned. Waiting for the Switchboard oracle to reveal the randomness.";
		case "revealing":
		case "revealed":
			return `Recorded on-chain: you won ${
				prizeTitle(state.result)
			}. Not yet claimed.`;
		case "claiming":
			return `Claiming ${prizeTitle(state.result)} to your wallet.`;
		case "claimed":
			return `${prizeTitle(state.result)} delivered to your wallet.`;
		case "failed":
			return state.message;
	}
}
