import {
	type CSSProperties,
	type KeyboardEvent,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	chargeLevel,
	HOLD_TO_OPEN_MS,
	type OpeningState,
	reactionFor,
} from "./openingMachine.js";

const ASSETS = "/animations/cartoon-chest";

export type ChestProps = Readonly<{
	state: OpeningState;
	/** Whether a hold may start an opening. When false a hold only rattles. */
	armed: boolean;
	reducedMotion: boolean;
	onHold(at: number): void;
	onRelease(): void;
	onCharged(): void;
	onBlocked(): void;
	onRevealFinished(): void;
}>;

function isHoldKey(event: KeyboardEvent): boolean {
	return event.key === " " || event.key === "Enter";
}

/**
 * The cartoon chest: press and hold to open.
 *
 * Holding charges the chest (squash, shake, rising light, haptics). A full
 * charge starts the real burn-and-commit transaction; the chest keeps rumbling
 * while the oracle reveals, then plays the reaction for the recorded tier. The
 * clip is decoration only: the prize card and live region carry the result.
 */
export function Chest(props: ChestProps) {
	const { state, armed, reducedMotion } = props;
	const stage = useRef<HTMLDivElement>(null);
	const video = useRef<HTMLVideoElement>(null);
	const callbacks = useRef(props);
	const [rattle, setRattle] = useState(0);
	const phase = state.phase;
	const reaction = "result" in state && state.result
		? reactionFor(state.result.tier)
		: null;

	callbacks.current = props;

	useEffect(() => {
		if (state.phase !== "charging") {
			stage.current?.style.setProperty("--charge", "0");
			return;
		}

		const startedAt = state.startedAt;
		let frame = 0;
		let lastPulse = 0;

		const tick = () => {
			const now = performance.now();
			const level = chargeLevel(startedAt, now);

			stage.current?.style.setProperty("--charge", level.toFixed(3));

			if (!reducedMotion && now - lastPulse > 180) {
				lastPulse = now;
				navigator.vibrate?.(Math.round(8 + level * 22));
			}

			if (level >= 1) {
				navigator.vibrate?.(60);
				callbacks.current.onCharged();
				return;
			}

			frame = requestAnimationFrame(tick);
		};

		frame = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(frame);
	}, [state, reducedMotion]);

	useEffect(() => {
		if (phase !== "revealing") return;

		if (reducedMotion) {
			callbacks.current.onRevealFinished();
			return;
		}

		void video.current?.play().catch(() => {
			// Autoplay can be refused (power saving, data saver). The recorded
			// result must never wait on decoration, so reveal the card at once.
			callbacks.current.onRevealFinished();
		});
	}, [phase, reducedMotion]);

	const start = () => {
		if (phase !== "idle") return;

		if (!armed) {
			setRattle((value) => value + 1);
			navigator.vibrate?.([20, 40, 20]);
			callbacks.current.onBlocked();
			return;
		}

		callbacks.current.onHold(performance.now());
	};
	const stop = () => {
		if (phase === "charging") callbacks.current.onRelease();
	};
	const busy = phase === "burning" || phase === "rolling";
	const showVideo = phase === "revealing" && reaction && !reducedMotion;
	const finalPose = reaction && phase !== "revealing"
		? `${ASSETS}/${reaction}-final.webp`
		: null;
	const label = armed
		? "Press and hold to open a box"
		: "Chest. Press to see why it is locked";

	return (
		<div
			className="chest"
			data-phase={phase}
			data-reaction={reaction ?? "none"}
			data-testid="chest"
			ref={stage}
			style={{ "--hold-ms": `${HOLD_TO_OPEN_MS}ms` } as CSSProperties}
		>
			<div className="chest-glow" aria-hidden="true" />
			<button
				type="button"
				className="chest-target"
				aria-label={label}
				aria-describedby="chest-hint"
				disabled={phase !== "idle" && phase !== "charging"}
				onPointerDown={(event) => {
					event.currentTarget.setPointerCapture?.(event.pointerId);
					start();
				}}
				onPointerUp={stop}
				onPointerCancel={stop}
				onLostPointerCapture={stop}
				onContextMenu={(event) => event.preventDefault()}
				onKeyDown={(event) => {
					if (!isHoldKey(event)) return;

					event.preventDefault();

					if (!event.repeat) start();
				}}
				onKeyUp={(event) => {
					if (!isHoldKey(event)) return;

					event.preventDefault();
					stop();
				}}
			>
				<span
					className="chest-body"
					key={rattle}
					data-rattle={rattle > 0 ? "true" : "false"}
					aria-hidden="true"
				>
					{showVideo
						? (
							<video
								ref={video}
								className="chest-media"
								muted
								playsInline
								preload="auto"
								poster={`${ASSETS}/chest-closed.webp`}
								onEnded={() => callbacks.current.onRevealFinished()}
								data-testid="chest-video"
							>
								<source
									src={`${ASSETS}/${reaction}.webm`}
									type='video/webm; codecs="vp9"'
								/>
								<source src={`${ASSETS}/${reaction}.mp4`} type="video/mp4" />
							</video>
						)
						: (
							<img
								className="chest-media"
								src={finalPose ?? `${ASSETS}/chest-closed.webp`}
								alt=""
								width={720}
								height={720}
								draggable={false}
							/>
						)}
				</span>
				<svg className="chest-ring" viewBox="0 0 100 100" aria-hidden="true">
					<circle className="chest-ring-track" cx="50" cy="50" r="46" />
					<circle
						className="chest-ring-fill"
						cx="50"
						cy="50"
						r="46"
						pathLength="1"
						data-busy={busy ? "true" : "false"}
					/>
				</svg>
			</button>
			{phase === "revealing" && (
				<button
					type="button"
					className="chest-skip"
					onClick={() => callbacks.current.onRevealFinished()}
				>
					Skip animation
				</button>
			)}
		</div>
	);
}
