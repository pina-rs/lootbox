/**
 * Every prize goes in before anyone opens a box: coins arc into the open
 * chest, its eyes following each one, then the lid slams and locks.
 */
import {
	AbsoluteFill,
	Easing,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

import type { PrizeKind } from "../data/demo.ts";
import { Chest } from "../kit/Chest.tsx";
import { Coin } from "../kit/Coin.tsx";
import {
	blinks,
	BOUNCE,
	enter,
	mix,
	POP,
	progress,
	squash,
} from "../kit/motion.ts";
import { SparkleBurst } from "../kit/Particles.tsx";
import { Sfx } from "../kit/Sound.tsx";
import { Caption } from "../kit/Type.tsx";

export const LOCK_FRAMES = 155;
const SLAM = 100;
const FLIGHT = 26;
const COINS: readonly Readonly<
	{ kind: PrizeKind; at: number; from: readonly [number, number] }
>[] = [
	{ kind: "sol", at: 12, from: [0.08, 0.3] },
	{ kind: "bonk", at: 20, from: [0.92, 0.25] },
	{ kind: "bonk", at: 28, from: [0.1, 0.72] },
	{ kind: "stock", at: 36, from: [0.9, 0.68] },
	{ kind: "nft", at: 44, from: [0.26, 0.08] },
	{ kind: "bonk", at: 52, from: [0.76, 0.06] },
	{ kind: "stock", at: 60, from: [0.06, 0.12] },
	{ kind: "nft", at: 68, from: [0.94, 0.86] },
];

export function LockIn(
	{
		caption = "Every prize is locked in before anyone opens a box.",
		stamp: showStamp = true,
	}: Readonly<{
		/** `null` leaves the caption out, e.g. when a character narrates. */
		caption?: string | null;
		/** The "Locked on chain" stamp; off when a character says it. */
		stamp?: boolean;
	}>,
) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const size = Math.min(width, height) * 0.58;
	const feetX = width / 2;
	const feetY = height * 0.74;
	const mouth = { x: feetX, y: feetY - size * 0.58 };
	const arrive = enter(frame, 0, BOUNCE);
	const lid = frame < SLAM
		? mix(0, 1.8, Math.min(1, enter(frame, 2, POP)))
		: interpolate(frame, [SLAM, SLAM + 5], [1.8, 0], {
			easing: Easing.in(Easing.cubic),
			extrapolateRight: "clamp",
		});

	const peek = frame > 128 ? enter(frame, 128, BOUNCE) * 0.9 : 0;
	const inFlight = COINS.find((coin) =>
		frame >= coin.at && frame < coin.at + FLIGHT
	);
	const target = inFlight
		? {
			x: (inFlight.from[0] - 0.5) * 2,
			y: Math.min(1, (inFlight.from[1] - 0.4) * 2),
		}
		: { x: 0, y: -0.6 };
	const stamp = enter(frame, SLAM + 8, BOUNCE);

	return (
		<AbsoluteFill>
			<Chest
				x={feetX}
				y={feetY}
				size={size * mix(0.4, 1, Math.min(1, arrive))}
				open={frame >= SLAM + 5 ? peek : lid}
				look={frame >= SLAM + 5 ? { x: 1, y: 0.2 } : target}
				blink={blinks(frame, [90, 140])}
				squash={frame >= SLAM + 5
					? squash(frame, SLAM + 5, 0.25)
					: squash(frame, 0, 0.12)}
			/>
			{COINS.map((coin, index) => {
				const t = progress(frame, coin.at, FLIGHT, Easing.inOut(Easing.quad));

				if (frame < coin.at || t >= 1) return null;

				const start = { x: coin.from[0] * width, y: coin.from[1] * height };
				const control = {
					x: (start.x + mouth.x) / 2,
					y: Math.min(start.y, mouth.y) - height * 0.28,
				};
				const x = (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x +
					t * t * mouth.x;
				const y = (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y +
					t * t * mouth.y;
				const coinSize = size * 0.34 * mix(1, 0.4, t);

				return (
					<Coin
						key={index}
						kind={coin.kind}
						size={coinSize}
						style={{
							position: "absolute",
							left: x - coinSize / 2,
							top: y - coinSize / 2,
							transform: `rotate(${t * 540}deg)`,
						}}
					/>
				);
			})}
			<SparkleBurst
				x={feetX}
				y={feetY - size * 0.45}
				at={SLAM + 6}
				radius={size * 0.75}
				size={size * 0.06}
			/>
			<div
				style={{
					position: "absolute",
					left: Math.min(feetX + size * 0.12, width - size * 1.05),
					top: feetY - size * 1.12,
					padding: `${size * 0.04}px ${size * 0.08}px`,
					border: "6px solid var(--ink)",
					borderRadius: 18,
					background: "var(--gold)",
					boxShadow: "0 8px 0 var(--ink)",
					font: `400 ${size * 0.13}px/1 var(--display)`,
					color: "var(--ink)",
					whiteSpace: "nowrap",
					opacity: showStamp ? Math.min(1, stamp * 2) : 0,
					transform: `rotate(-8deg) scale(${mix(2.2, 1, stamp)})`,
				}}
			>
				Locked on chain ✓
			</div>
			{caption && <Caption text={caption} at={SLAM + 18} until={LOCK_FRAMES} />}
			{COINS.map((coin, index) => (
				<Sfx
					key={index}
					name="coin-clink"
					at={coin.at + FLIGHT - 2}
					volume={0.45}
				/>
			))}
			<Sfx name="chest-thud" at={SLAM + 4} volume={0.8} />
			<Sfx name="lock-click" at={SLAM + 6} volume={0.8} />
			<Sfx name="sparkle" at={SLAM + 8} volume={0.5} />
		</AbsoluteFill>
	);
}
