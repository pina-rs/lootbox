import {
	chargeFrame,
	ChestFigure,
	type ChestFrame,
	idleFrame,
	mixFrames,
	nopeFrame,
	REST_FRAME,
	restFrame,
	revealFrame,
	revealSeconds,
	waitFrame,
} from "@pina-rs/lootbox-brand";
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
	type Reaction,
	reactionFor,
} from "./openingMachine.js";

/** Each new phase blends in from the pose on screen over this long. */
const BLEND_SECONDS = 0.2;

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
 * The chest character: press and hold to open.
 *
 * Holding charges the chest (it squashes, squints, and rattles its lid as the
 * light rises, with haptics). A full charge starts the real burn-and-commit
 * transaction; the chest rumbles and glances about while the oracle reveals,
 * then reacts to the recorded tier. The performance is decoration only: the
 * prize card and live region carry the result.
 */
export function Chest(props: ChestProps) {
	const { state, armed, reducedMotion } = props;
	const stage = useRef<HTMLDivElement>(null);
	const callbacks = useRef(props);
	const [nopeAt, setNopeAt] = useState<number | null>(null);
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
		if (phase !== "revealing" || !reaction) return;

		if (reducedMotion) {
			callbacks.current.onRevealFinished();
			return;
		}

		// A timer, not the animation, ends the reveal: background tabs pause
		// animation frames, and the recorded result must never wait on them.
		const timer = setTimeout(
			() => callbacks.current.onRevealFinished(),
			revealSeconds(reaction) * 1000,
		);

		return () => clearTimeout(timer);
	}, [phase, reaction, reducedMotion]);

	const start = () => {
		if (phase !== "idle") return;

		if (!armed) {
			setNopeAt(performance.now());
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
			{phase === "revealing" && reaction && reaction !== "disappointed" &&
				!reducedMotion && <Burst reaction={reaction} />}
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
				<Performer
					state={state}
					reaction={reaction}
					reducedMotion={reducedMotion}
					nopeAt={nopeAt}
				/>
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

/** The pose for a phase at one instant, before any blending. */
function phaseFrame(
	state: OpeningState,
	reaction: Reaction | null,
	now: number,
	sincePhase: number,
): ChestFrame {
	const clock = now / 1000;

	switch (state.phase) {
		case "idle":
			return idleFrame(clock);
		case "charging":
			return chargeFrame(chargeLevel(state.startedAt, now), clock);
		case "burning":
		case "rolling":
			return waitFrame(sincePhase);
		case "revealing":
			return reaction ? revealFrame(reaction, sincePhase) : idleFrame(clock);
		case "revealed":
		case "claiming":
		case "claimed":
		case "failed":
			return reaction ? restFrame(reaction, sincePhase) : idleFrame(clock);
	}
}

/**
 * Plays the brand's chest motion for the current phase, every animation
 * frame, blending each new phase in from whatever pose is on screen. Viewers
 * who prefer less motion see one still pose per outcome.
 */
function Performer(
	{ state, reaction, reducedMotion, nopeAt }: Readonly<{
		state: OpeningState;
		reaction: Reaction | null;
		reducedMotion: boolean;
		nopeAt: number | null;
	}>,
) {
	const still = reaction ? restFrame(reaction, 0) : REST_FRAME;
	const [frame, setFrame] = useState<ChestFrame>(still);
	const shown = useRef(frame);
	const latest = useRef(state);
	const phase = state.phase;
	const startedAt = state.phase === "charging" ? state.startedAt : null;

	latest.current = state;

	useEffect(() => {
		if (reducedMotion) {
			shown.current = still;
			setFrame(still);
			return;
		}

		const from = shown.current;
		const begin = performance.now();
		let handle = requestAnimationFrame(function tick(now) {
			const since = Math.max(0, (now - begin) / 1000);
			let next = phaseFrame(latest.current, reaction, now, since);

			if (nopeAt !== null) next = nopeFrame(next, (now - nopeAt) / 1000);
			if (since < BLEND_SECONDS) {
				next = mixFrames(from, next, since / BLEND_SECONDS);
			}

			shown.current = next;
			setFrame(next);
			handle = requestAnimationFrame(tick);
		});

		return () => cancelAnimationFrame(handle);
		// `still` follows `reaction`; `latest` carries the rest of the state.
	}, [phase, startedAt, reaction, reducedMotion, nopeAt]);

	return <ChestFigure className="chest-figure" frame={frame} />;
}

/** Confetti and rays, timed to the lid flying open. */
function Burst({ reaction }: Readonly<{ reaction: Reaction }>) {
	const big = reaction === "big-prize";
	const pieces = big ? BIG_PIECES : SMALL_PIECES;

	return (
		<div className="chest-burst" data-reaction={reaction} aria-hidden="true">
			{pieces.map((piece, index) => (
				<span
					key={index}
					style={{
						"--angle": `${piece.angle}deg`,
						"--distance": `${piece.distance}px`,
						"--spin": `${piece.spin}deg`,
						"--delay": `${(big ? 0.55 : 0.45) + piece.delay}s`,
						"--color": piece.color,
					} as CSSProperties}
				/>
			))}
		</div>
	);
}

type Piece = Readonly<{
	angle: number;
	distance: number;
	spin: number;
	delay: number;
	color: string;
}>;

const COLORS = ["var(--gold)", "var(--teal)", "var(--coral)", "#9b7be0"];

/** Fanned out and upward, like the lid throws them. */
const BIG_PIECES: readonly Piece[] = Array.from({ length: 22 }, (_, index) => ({
	angle: -110 + index * (220 / 21),
	distance: 130 + ((index * 37) % 70),
	spin: 180 + ((index * 53) % 360),
	delay: (index % 4) * 0.04,
	color: COLORS[index % COLORS.length] ?? "var(--gold)",
}));

const SMALL_PIECES: readonly Piece[] = Array.from(
	{ length: 10 },
	(_, index) => ({
		angle: -70 + index * (140 / 9),
		distance: 90 + ((index * 29) % 40),
		spin: 90 + ((index * 41) % 180),
		delay: (index % 3) * 0.05,
		color: "var(--gold)",
	}),
);
