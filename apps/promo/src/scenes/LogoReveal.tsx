/**
 * The logo, performed: the chest drops in on the sting's thunk, pops its lid,
 * the letters rain down, and the chest and the word turn to look at each
 * other. Laid out like the static lockups in @pina-rs/lootbox-brand.
 */
import {
	Wordmark,
	WORDMARK_ASPECT,
	WORDMARK_VIEWBOX,
} from "@pina-rs/lootbox-brand";
import {
	AbsoluteFill,
	Easing,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

import { Chest } from "../kit/Chest.tsx";
import {
	blinks,
	BOUNCE,
	enter,
	float,
	mix,
	progress,
	squash,
} from "../kit/motion.ts";
import { SparkleBurst, sparkleD } from "../kit/Particles.tsx";

export type LogoLayout = "horizontal" | "stacked";

/** When the chest lands; the sting's thunk sits at 0.5 s. */
export const LAND = 15;
const LID = 19;
const LETTERS = 30;
const LETTER_GAP = 4;
const TAGLINE = 72;

type Placement = Readonly<{
	markX: number;
	markY: number;
	mark: number;
	wordX: number;
	wordY: number;
	wordHeight: number;
	taglineY: number;
}>;

function place(layout: LogoLayout, width: number, height: number): Placement {
	if (layout === "stacked") {
		const unit = Math.min(width / 1.45, height / 1.5);
		const wordWidth = 1.3 * unit;
		const wordHeight = wordWidth / WORDMARK_ASPECT;
		const top = (height - (0.9 * unit + wordHeight + 110)) / 2;

		return {
			markX: (width - unit) / 2,
			markY: top,
			mark: unit,
			wordX: (width - wordWidth) / 2,
			wordY: top + 0.9 * unit,
			wordHeight,
			taglineY: top + 0.9 * unit + wordHeight + 40,
		};
	}

	const unit = Math.min(width / 3.7, height / 1.7);
	const wordHeight = 0.361 * unit;
	const total = unit * (1.04 + 0.361 * WORDMARK_ASPECT);
	const left = (width - total) / 2;
	const top = (height - unit) / 2 - unit * 0.12;

	return {
		markX: left,
		markY: top,
		mark: unit,
		wordX: left + 1.04 * unit,
		wordY: top + 0.488 * unit,
		wordHeight,
		taglineY: top + unit + 16,
	};
}

export function LogoReveal(
	{ layout = "horizontal", tagline = "Sealed gifts. Real prizes." }: Readonly<{
		layout?: LogoLayout;
		tagline?: string;
	}>,
) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const spot = place(layout, width, height);
	// The mark's viewBox starts at (36, 60) and spans 440 units.
	const unit = spot.mark / 440;
	const feetX = spot.markX + (256 - 36) * unit;
	const feetY = spot.markY + (450 - 60) * unit;
	const fall = interpolate(frame, [4, LAND], [-height, 0], {
		easing: Easing.in(Easing.quad),
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const lid = frame < LID ? 0 : enter(frame, LID, BOUNCE);

	const settled = progress(frame, LETTERS + 20, 16);
	const facing = layout === "stacked" ? { x: 0, y: 1 } : { x: 1, y: 0.1 };
	const chestLook = {
		x: mix(0, facing.x, settled),
		y: mix(-0.3, facing.y, settled),
	};
	const wordLook = layout === "stacked"
		? { x: mix(0, 0, settled), y: mix(0.8, -1, settled) }
		: { x: mix(0, -1, settled), y: mix(0.8, 0.55, settled) };
	const idle = frame > 100 ? float(frame - 100, 3, 80) : 0;
	const streak = progress(frame, 0, 12, Easing.out(Easing.cubic));
	const taglineIn = enter(frame, TAGLINE);

	return (
		<AbsoluteFill>
			{frame < 14 && (
				<svg
					style={{ position: "absolute", inset: 0 }}
					width={width}
					height={height}
				>
					<line
						x1={mix(-80, feetX - 60, Math.max(0, streak - 0.25))}
						y1={mix(-80, feetY - spot.mark * 0.7, Math.max(0, streak - 0.25))}
						x2={mix(-80, feetX, streak)}
						y2={mix(-80, feetY - spot.mark * 0.62, streak)}
						stroke="var(--gold)"
						strokeWidth={10}
						strokeLinecap="round"
					/>
					<path
						d={sparkleD(30)}
						fill="var(--gold)"
						stroke="var(--ink)"
						strokeWidth={5}
						transform={`translate(${mix(-80, feetX, streak)} ${
							mix(-80, feetY - spot.mark * 0.62, streak)
						}) rotate(${frame * 20})`}
					/>
				</svg>
			)}
			<Chest
				x={feetX}
				y={feetY}
				size={spot.mark}
				lift={-fall - idle}
				squash={squash(frame, LAND, 0.2)}
				open={lid}
				look={chestLook}
				blink={blinks(frame, [LID + 8, 104])}
				sparkles={frame > LID + 6}
			/>
			<SparkleBurst
				x={feetX}
				y={feetY - spot.mark * 0.62}
				at={LID + 2}
				radius={spot.mark * 0.55}
				size={spot.mark * 0.05}
			/>
			<Wordmark
				height={spot.wordHeight}
				width={spot.wordHeight * WORDMARK_ASPECT}
				title=""
				look={wordLook}
				blink={blinks(frame, [88, 118])}
				style={{
					position: "absolute",
					left: spot.wordX,
					top: spot.wordY,
					overflow: "visible",
				}}
				letterTransform={(letter) => {
					const t = enter(frame, LETTERS + letter.index * LETTER_GAP, BOUNCE);
					// Start fully above the frame, in wordmark units.
					const scale = spot.wordHeight / WORDMARK_VIEWBOX.height;
					const drop = mix(-(spot.wordY + spot.wordHeight * 1.5) / scale, 0, t);
					const tilt = mix(letter.index % 2 === 0 ? -14 : 12, 0, t);
					const centre = letter.advance / 2;

					return `translate(0 ${drop}) rotate(${tilt} ${centre} -360)`;
				}}
			/>
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: spot.taglineY,
					textAlign: "center",
					font: `900 ${Math.round(spot.mark * 0.11)}px/1.2 var(--body)`,
					color: "var(--ink-soft)",
					opacity: Math.min(1, taglineIn),
					transform: `translateY(${mix(30, 0, Math.min(1, taglineIn))}px)`,
				}}
			>
				{tagline}
			</div>
		</AbsoluteFill>
	);
}
