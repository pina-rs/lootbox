import type { Rive } from "@rive-app/canvas";
import { useEffect, useRef, useState } from "react";
import { revealAnimations, type RevealOutcome } from "./reveal.js";
import "./machine.css";

export type MachinePhase =
	| "received"
	| "idle"
	| "commit"
	| "burn"
	| "reveal"
	| "revealed"
	| "redeemed";

type Props = {
	phase: MachinePhase;
	outcome?: RevealOutcome;
	playReveal?: boolean;
	onRevealComplete?: () => void;
};
const assetPath = "/animations/ink-chest";

export function LootboxMachine(
	{ phase, outcome = "small-prize", playReveal = false, onRevealComplete }:
		Props,
) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const [playback, setPlayback] = useState<
		"still" | "loading" | "playing" | "failed"
	>("still");
	const opened = phase === "revealed" || phase === "redeemed";
	const shouldPlay = opened && playReveal;

	useEffect(() => {
		if (!shouldPlay) {
			setPlayback("still");
			return;
		}
		const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
		if (motion.matches) {
			onRevealComplete?.();
			return;
		}
		let disposed = false;
		let player: Rive | undefined;
		let observer: ResizeObserver | undefined;
		let completed = false;
		const finish = () => {
			if (disposed || completed) return;
			completed = true;
			clearTimeout(deadline);
			player?.stop();
			setPlayback("still");
			onRevealComplete?.();
		};
		const fail = (error: unknown) => {
			if (disposed || completed) return;
			console.error("Prize animation unavailable", error);
			finish();
			setPlayback("failed");
		};
		// Missing assets must not leave an endless loading state.
		let deadline = window.setTimeout(
			() => fail(new Error("Rive loading timed out")),
			10_000,
		);
		const motionChanged = () => {
			if (motion.matches) finish();
		};
		motion.addEventListener("change", motionChanged);
		setPlayback("loading");
		async function start() {
			const [
				{ Rive, Layout, Fit, Alignment, RuntimeLoader },
				{ default: wasmUrl },
			] = await Promise.all([
				import("@rive-app/canvas"),
				import("@rive-app/canvas/rive.wasm?url"),
			]);
			if (disposed || completed || !canvas.current) return;
			RuntimeLoader.setWasmUrl(wasmUrl);
			RuntimeLoader.setWasmFallbackUrl(null);
			player = new Rive({
				canvas: canvas.current,
				src: `${assetPath}/ink-chest.riv`,
				artboard: "Ink chest",
				animations: revealAnimations[outcome],
				autoplay: true,
				layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
				onLoad: () => {
					if (disposed || completed) return;
					clearTimeout(deadline);
					deadline = window.setTimeout(
						() => fail(new Error("Rive playback timed out")),
						8_000,
					);
					player?.resizeDrawingSurfaceToCanvas();
					setPlayback("playing");
				},
				onLoadError: fail,
				onStop: finish,
			});
			observer = new ResizeObserver(() =>
				player?.resizeDrawingSurfaceToCanvas()
			);
			observer.observe(canvas.current);
		}
		void start().catch(fail);
		return () => {
			disposed = true;
			clearTimeout(deadline);
			motion.removeEventListener("change", motionChanged);
			observer?.disconnect();
			player?.cleanup();
		};
	}, [shouldPlay, outcome, onRevealComplete]);

	return (
		<div
			className="ink-machine"
			data-phase={phase}
			data-outcome={outcome}
			data-playback={playback}
			data-testid="lootbox-machine"
		>
			<div className="ink-machine__art" aria-hidden="true">
				<img
					src={`${assetPath}/${opened && !shouldPlay ? outcome : "closed"}.png`}
					width="640"
					height="640"
					alt=""
				/>
				{shouldPlay && (
					<canvas
						ref={canvas}
						className={playback === "playing" ? "is-playing" : ""}
					/>
				)}
			</div>
			{shouldPlay && playback !== "failed" && (
				<button
					type="button"
					className="ink-machine__skip"
					onClick={onRevealComplete}
				>
					Skip animation
				</button>
			)}
		</div>
	);
}
