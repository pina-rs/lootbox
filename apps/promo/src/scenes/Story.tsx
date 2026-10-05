/**
 * Scenes for "The chest's story": the mascot tells you what it is, in its
 * own voice. Built for a square frame but they scale with the composition.
 */
import { ChestMark } from "@pina-rs/lootbox-brand";
import {
	AbsoluteFill,
	Easing,
	interpolate,
	OffthreadVideo,
	Sequence,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

import { DEMO_WALLETS } from "../data/demo.ts";
import { Bubble } from "../kit/Bubble.tsx";
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
import { Confetti, SparkleBurst } from "../kit/Particles.tsx";
import { Sfx } from "../kit/Sound.tsx";

/** The chest pops up from the floor, looks around, and says hello. */
export function StoryHello() {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const size = Math.min(width, height) * 0.55;
	const rise = enter(frame, 6, BOUNCE);
	const lookX = interpolate(frame, [20, 32, 44, 56], [0, -1, 1, 0.3], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	return (
		<AbsoluteFill>
			<Chest
				x={width * 0.42}
				y={height * 0.86 + (1 - Math.min(1, rise)) * size * 0.9}
				size={size}
				open={mix(0, 1.1, Math.min(1, rise))}
				look={{ x: lookX, y: -0.1 }}
				blink={blinks(frame, [62, 100])}
				squash={squash(frame, 14, 0.12)}
			/>
			<Bubble
				text="Psst. I'm a lootbox."
				at={58}
				until={118}
				x={width * 0.5}
				y={height * 0.14}
				width={width * 0.44}
				size={height * 0.05}
			/>
			<Sfx name="chest-creak" at={8} volume={0.5} />
		</AbsoluteFill>
	);
}

/** Copies of the chest hop out to a ring of friends. */
export function StoryCopies() {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const centre = { x: width / 2, y: height * 0.72 };
	const size = Math.min(width, height) * 0.28;
	const friends = DEMO_WALLETS.slice(0, 6);
	const radius = Math.min(width, height) * 0.33;

	return (
		<AbsoluteFill>
			{friends.map((friend, index) => {
				const angle = Math.PI + (index / (friends.length - 1)) * Math.PI;
				const fx = centre.x + Math.cos(angle) * radius * 1.15;
				const fy = centre.y + Math.sin(angle) * radius * 0.95;
				const appear = enter(frame, 4 + index * 3, POP);
				const hop = progress(
					frame,
					30 + index * 8,
					18,
					Easing.inOut(Easing.quad),
				);
				const landed = hop >= 1;
				const cx = mix(centre.x, fx, hop);
				const cy = mix(centre.y, fy - size * 0.12, hop) -
					Math.sin(hop * Math.PI) * height * 0.18;

				return (
					<div key={friend.address}>
						<div
							style={{
								position: "absolute",
								left: fx - size * 0.3,
								top: fy - size * 0.3,
								width: size * 0.6,
								height: size * 0.6,
								borderRadius: "50%",
								border: "6px solid var(--ink)",
								background: friend.color,
								boxShadow: landed
									? "0 0 0 10px var(--gold)"
									: "0 6px 0 var(--ink)",
								transform: `scale(${appear})`,
							}}
						/>
						{frame >= 30 + index * 8 && (
							<ChestMark
								variant="compact"
								size={size * 0.55}
								open={landed ? 0.9 : 0.4}
								shadow={false}
								look={{ x: 0, y: 1 }}
								style={{
									position: "absolute",
									left: cx - size * 0.275,
									top: cy - size * 0.4,
								}}
							/>
						)}
					</div>
				);
			})}
			<Chest
				x={centre.x}
				y={centre.y + size * 0.35}
				size={size}
				open={1.2}
				look={{ x: Math.sin(frame / 8), y: -0.3 }}
				blink={blinks(frame, [90])}
				squash={squash(frame, 30, 0.1)}
			/>
			<Bubble
				text="Send me to your friends…"
				at={6}
				until={110}
				x={width * 0.08}
				y={height * 0.06}
				width={width * 0.52}
				size={height * 0.048}
				tail="right"
			/>
			{friends.map((_, index) => (
				<Sfx key={index} name="blip-up" at={30 + index * 8 + 18} volume={0.4} />
			))}
		</AbsoluteFill>
	);
}

/** The price curve as a staircase: chests hop up it, each step pricier. */
export function StoryStaircase() {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const steps = 7;
	const stepWidth = width * 0.105;
	const floor = height * 0.9;
	const left = width * 0.1;
	const stepHeight = (index: number) => height * (0.08 + index * 0.06);
	const size = stepWidth * 1.1;

	return (
		<AbsoluteFill>
			{Array.from({ length: steps }, (_, index) => {
				const rise = enter(frame, index * 3, POP);
				const h = stepHeight(index) * rise;
				const price = (0.01 + index * 0.0067).toFixed(3);

				return (
					<div key={index}>
						<div
							style={{
								position: "absolute",
								left: left + index * stepWidth * 1.08,
								top: floor - h,
								width: stepWidth,
								height: h,
								border: "6px solid var(--ink)",
								borderRadius: 14,
								background: frame > 40 + index * 10
									? "var(--teal-bright)"
									: "var(--paper)",
							}}
						/>
						<span
							style={{
								position: "absolute",
								left: left + index * stepWidth * 1.08,
								top: floor + 10,
								width: stepWidth,
								textAlign: "center",
								font: `900 ${height * 0.024}px/1 var(--body)`,
								opacity: rise,
							}}
						>
							{price}
						</span>
					</div>
				);
			})}
			{[0, 1, 2].map((chestIndex) => {
				const start = 34 + chestIndex * 22;
				const climb = Math.max(0, (frame - start) / 10);
				const step = Math.min(steps - 1 - chestIndex, Math.floor(climb));
				const phase = climb - Math.floor(climb);
				const x = left + step * stepWidth * 1.08 + stepWidth / 2;
				const y = floor - stepHeight(step);
				const hopHeight = step < steps - 1 - chestIndex
					? Math.sin(phase * Math.PI) * height * 0.06
					: 0;

				if (frame < start) return null;

				return (
					<Chest
						key={chestIndex}
						x={x +
							(step < steps - 1 - chestIndex ? phase * stepWidth * 1.08 : 0)}
						y={y}
						size={size}
						lift={hopHeight}
						open={0.8}
						look={{ x: 1, y: -0.4 }}
						squash={squash(frame, start + Math.floor(climb) * 10, 0.1)}
					/>
				);
			})}
			<Bubble
				text="…or sell me on a curve."
				at={8}
				until={118}
				x={width * 0.44}
				y={height * 0.08}
				width={width * 0.5}
				size={height * 0.048}
			/>
			<Coin
				kind="sol"
				size={height * 0.09}
				style={{
					position: "absolute",
					left: width * 0.84,
					top: height * 0.3,
					transform: `translateY(${Math.sin(frame / 7) * 10}px)`,
				}}
			/>
			{Array.from(
				{ length: 9 },
				(_, index) => (
					<Sfx key={index} name="blip-up" at={44 + index * 10} volume={0.3} />
				),
			)}
		</AbsoluteFill>
	);
}

/** Hold the chest: the ring fills, the chest leaps, and out comes a prize. */
export function StoryOpen() {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const size = Math.min(width, height) * 0.62;
	const hold = 24;
	const pop = 74;
	const charge = progress(frame, hold, pop - hold, (t) => t);
	const shake = frame >= hold && frame < pop
		? Math.sin(frame * 2.3) * (1 + charge * 4)
		: 0;
	const ringRadius = size * 0.62;

	return (
		<AbsoluteFill>
			{frame < pop
				? (
					<>
						<svg
							width={width}
							height={height}
							style={{
								position: "absolute",
								inset: 0,
								transform: "rotate(-90deg)",
								transformOrigin: "center",
							}}
						>
							<circle
								cx={width / 2}
								cy={height * 0.55}
								r={ringRadius}
								fill="none"
								stroke="var(--line)"
								strokeWidth={6}
							/>
							<circle
								cx={width / 2}
								cy={height * 0.55}
								r={ringRadius}
								fill="none"
								stroke="var(--teal)"
								strokeWidth={18}
								strokeLinecap="round"
								pathLength={1}
								strokeDasharray={1}
								strokeDashoffset={1 - charge}
							/>
						</svg>
						<Chest
							x={width / 2}
							y={height * 0.55 + size * 0.42}
							size={size}
							rotate={shake}
							squash={{ x: 1 + charge * 0.08, y: 1 - charge * 0.1 }}
							open={charge * 0.4}
							look={{ x: 0, y: -1 }}
						/>
						<Bubble
							text="Now hold me…"
							at={4}
							until={pop - 6}
							x={width * 0.52}
							y={height * 0.06}
							width={width * 0.4}
							size={height * 0.05}
						/>
					</>
				)
				: (
					<Sequence from={pop} layout="none">
						<OffthreadVideo
							src={staticFile("chest/big-prize.mp4")}
							muted
							style={{
								position: "absolute",
								left: (width - size * 1.4) / 2,
								top: height * 0.55 - size * 0.78,
								width: size * 1.4,
								height: size * 1.4,
								mixBlendMode: "darken",
							}}
						/>
					</Sequence>
				)}
			<SparkleBurst
				x={width / 2}
				y={height * 0.4}
				at={pop + 22}
				radius={size * 0.7}
				size={size * 0.06}
			/>
			<Confetti
				x={width / 2}
				y={height * 0.45}
				at={pop + 24}
				count={80}
				seed="story"
			/>
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: height * 0.08,
					textAlign: "center",
					font: `400 ${height * 0.1}px/1 var(--display)`,
					opacity: Math.min(1, enter(frame, pop + 28, BOUNCE)),
					transform: `scale(${
						mix(0.4, 1, Math.min(1.1, enter(frame, pop + 28, BOUNCE)))
					})`,
				}}
			>
				1 SOL!
			</div>
			<Sfx name="drumroll" at={hold} volume={0.55} />
			<Sfx name="chest-creak" at={pop + 10} volume={0.5} />
			<Sfx name="fanfare-short" at={pop + 26} volume={0.7} />
		</AbsoluteFill>
	);
}
