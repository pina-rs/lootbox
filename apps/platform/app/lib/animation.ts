/** Hooks for the chest character's motion. */
import { useEffect, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion(): boolean {
	return typeof matchMedia !== "undefined" &&
		matchMedia(REDUCED_MOTION).matches;
}

function subscribeMotion(callback: () => void): () => void {
	const query = matchMedia(REDUCED_MOTION);

	query.addEventListener("change", callback);

	return () => query.removeEventListener("change", callback);
}

/** Whether the viewer asked for less motion. False on the server. */
export function useReducedMotion(): boolean {
	return useSyncExternalStore(
		subscribeMotion,
		prefersReducedMotion,
		() => false,
	);
}

/**
 * Seconds since `running` turned on, advanced every animation frame. It is 0
 * while off, so the server and viewers who prefer less motion get a still
 * pose, and the first client render matches the server's.
 */
export function useAnimationSeconds(running: boolean): number {
	const [seconds, setSeconds] = useState(0);

	useEffect(() => {
		if (!running) {
			setSeconds(0);
			return;
		}

		const start = performance.now();
		let handle = requestAnimationFrame(function tick(now) {
			setSeconds((now - start) / 1000);
			handle = requestAnimationFrame(tick);
		});

		return () => cancelAnimationFrame(handle);
	}, [running]);

	return seconds;
}
