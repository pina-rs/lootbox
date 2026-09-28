/**
 * The lootbox mark: the cartoon chest, lid lifted, peeking out at you.
 *
 * Drawn on a 512-unit square. Every moving part is a prop so the same
 * drawing serves the site header, the favicon exports, and the promo videos:
 * `open` lifts and tilts the lid, `look` steers the pupils, and `blink`
 * closes the eyes. The defaults are the logo pose.
 */
import { type SVGProps, useId } from "react";

import {
	clamp,
	type Point,
	roundedPolygon,
	sparklePath,
	svgId,
} from "./geometry.ts";
import { palette } from "./tokens.ts";

export type ChestMarkVariant = "full" | "compact";

export type Gaze = Readonly<{
	/** -1 looks left, 1 looks right. */
	x: number;
	/** -1 looks up, 1 looks down. */
	y: number;
}>;

/** How the chest is drawn and posed. Every field has a logo default. */
export type ChestPose = Readonly<{
	/**
	 * `full` for 64 px and up; `compact` drops seams, rivets, and sparkles and
	 * thickens the ink so the chest survives at icon sizes.
	 */
	variant?: ChestMarkVariant | undefined;
	/** Lid opening: 0 is shut (eyes hidden), 1 is the logo's peek. Up to 2. */
	open?: number | undefined;
	/** Pupil direction. The logo glances right, toward the wordmark. */
	look?: Gaze | undefined;
	/** 0 is wide open, 1 is fully closed. */
	blink?: number | undefined;
	/** Sparkles by the lid. Defaults on for `full`. */
	sparkles?: boolean | undefined;
	/**
	 * The floor shadow. Turn it off when the chest moves off the floor and
	 * the caller draws its own.
	 */
	shadow?: boolean | undefined;
}>;

export type ChestMarkProps =
	& ChestPose
	& Readonly<{
		/** Accessible name. Without it the mark is decorative. */
		title?: string;
		/** Rendered width and height; any CSS length or a number of px. */
		size?: number | string;
	}>
	& Omit<SVGProps<SVGSVGElement>, "children" | "viewBox" | "width" | "height">;

/** The logo's resting pose. */
export const LOGO_LOOK: Gaze = { x: 1, y: -0.15 };

/** The square of mark units the chest is drawn in. */
const MARK_BOX = { x: 36, y: 60, size: 440 } as const;

/**
 * The SVG transform that draws `ChestArt` as a `size`-wide square at (x, y),
 * matching `ChestMark` at the same place and size.
 */
export function chestTransform(x: number, y: number, size: number): string {
	return `translate(${x} ${y}) scale(${
		size / MARK_BOX.size
	}) translate(${-MARK_BOX
		.x} ${-MARK_BOX.y})`;
}

// Body: a gently tapered box. Coordinates are in mark units.
const BODY_TOP = 280;
const BODY_BOTTOM = 428;
const BODY: readonly Point[] = [
	[100, BODY_TOP],
	[412, BODY_TOP],
	[396, BODY_BOTTOM],
	[116, BODY_BOTTOM],
];
const RIM_DEPTH = 34;
const BASE_DEPTH = 30;
const STRAPS = [[136, 174], [338, 376]] as const;
const FEET = [[128, 180], [332, 384]] as const;

// Lid, in lid space: origin at the middle of its bottom edge.
const LID_HALF_WIDTH = 168;
const LID_HEIGHT = 104;
const LID_BAND = 32;
const LID_STRAPS = [[-120, -82], [82, 120]] as const;
/** At `open = 1` the lid tilts this many degrees. */
const PEEK_TILT = -7;

const EYE_Y = BODY_TOP - 30;

type Look = Readonly<{
	stroke: number;
	/** Lid lift at `open = 1`; bigger eyes need a wider gap. */
	lift: number;
	eyeRadius: readonly [x: number, y: number];
	eyeGap: number;
	details: boolean;
}>;

const LOOKS: Record<ChestMarkVariant, Look> = {
	full: {
		stroke: 12,
		lift: 66,
		eyeRadius: [18, 27],
		eyeGap: 58,
		details: true,
	},
	compact: {
		stroke: 20,
		lift: 74,
		eyeRadius: [24, 34],
		eyeGap: 40,
		details: false,
	},
};

function edgeX(side: "left" | "right", y: number): number {
	const [top, bottom] = side === "left"
		? [BODY[0], BODY[3]]
		: [BODY[1], BODY[2]];

	if (!top || !bottom) return 0;

	const t = (y - top[1]) / (bottom[1] - top[1]);

	return top[0] + (bottom[0] - top[0]) * t;
}

/** A horizontal band across the tapered body, from y0 to y1. */
function band(y0: number, y1: number): string {
	return roundedPolygon([
		[edgeX("left", y0), y0],
		[edgeX("right", y0), y0],
		[edgeX("right", y1), y1],
		[edgeX("left", y1), y1],
	], 7);
}

const LID_OUTLINE = [
	`M${-LID_HALF_WIDTH},0`,
	`V${-LID_HEIGHT + 40}`,
	`Q${-LID_HALF_WIDTH},${-LID_HEIGHT + 6} ${-LID_HALF_WIDTH + 30},${
		-LID_HEIGHT + 2
	}`,
	`Q0,${-LID_HEIGHT - 14} ${LID_HALF_WIDTH - 30},${-LID_HEIGHT + 2}`,
	`Q${LID_HALF_WIDTH},${-LID_HEIGHT + 6} ${LID_HALF_WIDTH},${-LID_HEIGHT + 40}`,
	`V0Z`,
].join("");

/** The lock plate: a shield hanging from the rim, with a keyhole. */
function LockPlate({ top }: Readonly<{ top: number }>) {
	const width = 62;
	const height = 76;
	const left = 256 - width / 2;
	const right = 256 + width / 2;

	return (
		<g>
			<path
				d={`M${left},${top + 8}Q${left},${top} ${left + 8},${top}H${
					right - 8
				}Q${right},${top} ${right},${top + 8}V${top + height - 22}L256,${
					top + height
				}L${left},${top + height - 22}Z`}
				fill={palette.coral}
				stroke={palette.ink}
				strokeWidth={8}
				strokeLinejoin="round"
			/>
			<path
				d={`M${right - 12},${top + 8}V${top + height - 26}L260,${
					top + height - 10
				}`}
				fill="none"
				stroke={palette.coralShade}
				strokeWidth={6}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx={256} cy={top + 27} r={9} fill={palette.ink} />
			<path
				d={`M251,${top + 30}L248,${top + 48}H264L261,${top + 30}Z`}
				fill={palette.ink}
			/>
		</g>
	);
}

function Eye(
	{ cx, radius, look, blink }: Readonly<{
		cx: number;
		radius: readonly [number, number];
		look: Gaze;
		blink: number;
	}>,
) {
	const [rx, ry] = radius;
	const px = cx + clamp(look.x, -1, 1) * rx * 0.36;
	const py = EYE_Y + clamp(look.y, -1, 1) * ry * 0.32;
	const squash = 1 - clamp(blink, 0, 1) * 0.92;

	return (
		<g
			data-part="eye"
			transform={squash === 1
				? undefined
				: `translate(${cx} ${EYE_Y}) scale(1 ${squash}) translate(${-cx} ${-EYE_Y})`}
		>
			<ellipse cx={cx} cy={EYE_Y} rx={rx} ry={ry} fill={palette.white} />
			<ellipse
				cx={px}
				cy={py}
				rx={rx * 0.56}
				ry={ry * 0.6}
				fill={palette.ink}
			/>
			<circle
				cx={px - rx * 0.15}
				cy={py - ry * 0.28}
				r={rx * 0.2}
				fill={palette.white}
			/>
		</g>
	);
}

export function ChestMark(
	{
		variant,
		open,
		look,
		blink,
		sparkles,
		shadow,
		title,
		size,
		...svg
	}: ChestMarkProps,
) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={`${MARK_BOX.x} ${MARK_BOX.y} ${MARK_BOX.size} ${MARK_BOX.size}`}
			width={size}
			height={size}
			role={title ? "img" : undefined}
			aria-label={title}
			aria-hidden={title ? undefined : true}
			{...svg}
		>
			<ChestArt
				variant={variant}
				open={open}
				look={look}
				blink={blink}
				sparkles={sparkles}
				shadow={shadow}
			/>
		</svg>
	);
}

/**
 * The chest's shapes in mark units, without an `<svg>` of their own. Place
 * it inside another drawing with `chestTransform`, so lockups stay a single
 * flat SVG that every design tool opens the same way.
 */
export function ChestArt(
	{
		variant = "full",
		open = 1,
		look = LOGO_LOOK,
		blink = 0,
		sparkles,
		shadow = true,
	}: ChestPose,
) {
	const id = svgId(useId());
	const style = LOOKS[variant];
	const opening = clamp(open, 0, 2);
	const lidY = BODY_TOP - style.lift * opening;
	const tilt = PEEK_TILT * opening;
	const [eyeRx] = style.eyeRadius;
	const eyeOffset = style.eyeGap / 2 + eyeRx - 2;
	const showSparkles = sparkles ?? variant === "full";
	const bodyPath = roundedPolygon(BODY, 18);
	const ink = palette.ink;

	return (
		<>
			<defs>
				<clipPath id={`${id}-body`}>
					<path d={bodyPath} />
				</clipPath>
				<clipPath id={`${id}-lid`}>
					<path d={LID_OUTLINE} />
				</clipPath>
				<radialGradient id={`${id}-glow`} cx="50%" cy="55%" r="55%">
					<stop offset="0" stopColor={palette.gold} stopOpacity={0.7} />
					<stop offset="1" stopColor={palette.gold} stopOpacity={0} />
				</radialGradient>
			</defs>

			{shadow && (
				<ellipse cx={256} cy={454} rx={176} ry={14} fill={ink} opacity={0.14} />
			)}

			{/* The dark inside, the treasure's glow, and whoever lives in there. */}
			<path
				d={roundedPolygon([
					[118, BODY_TOP + 6],
					[122, lidY - 70],
					[390, lidY - 70],
					[394, BODY_TOP + 6],
				], 10)}
				fill={palette.inside}
			/>
			<ellipse
				cx={256}
				cy={BODY_TOP}
				rx={130}
				ry={34}
				fill={`url(#${id}-glow)`}
			/>
			<Eye
				cx={256 - eyeOffset}
				radius={style.eyeRadius}
				look={look}
				blink={blink}
			/>
			<Eye
				cx={256 + eyeOffset}
				radius={style.eyeRadius}
				look={look}
				blink={blink}
			/>

			{FEET.map(([left, right]) => (
				<path
					key={left}
					d={roundedPolygon([[left, 416], [right, 416], [right - 2, 450], [
						left + 2,
						450,
					]], 8)}
					fill={palette.goldShade}
					stroke={ink}
					strokeWidth={style.stroke}
					strokeLinejoin="round"
				/>
			))}

			<path d={bodyPath} fill={palette.teal} />
			<path
				d={`M338,${BODY_TOP}H420V${BODY_BOTTOM}H316Z`}
				fill={palette.tealShade}
				clipPath={`url(#${id}-body)`}
			/>
			{style.details && (
				<path
					d="M196,356H222M292,392H330"
					stroke={ink}
					strokeWidth={5}
					strokeLinecap="round"
					opacity={0.3}
				/>
			)}
			{STRAPS.map(([left, right]) => (
				<path
					key={left}
					d={roundedPolygon([
						[left, BODY_TOP + 4],
						[right, BODY_TOP + 4],
						[right - 2, BODY_BOTTOM - 4],
						[left + 2, BODY_BOTTOM - 4],
					], 6)}
					fill={palette.gold}
					stroke={ink}
					strokeWidth={8}
					strokeLinejoin="round"
				/>
			))}
			<path
				d={band(BODY_TOP, BODY_TOP + RIM_DEPTH)}
				fill={palette.gold}
				stroke={ink}
				strokeWidth={8}
				strokeLinejoin="round"
			/>
			<path
				d={band(BODY_BOTTOM - BASE_DEPTH, BODY_BOTTOM)}
				fill={palette.gold}
				stroke={ink}
				strokeWidth={8}
				strokeLinejoin="round"
			/>
			{style.details && (
				<g>
					<path
						d={`M${edgeX("left", BODY_TOP) + 26},${BODY_TOP + 11}H${
							edgeX("right", BODY_TOP) - 40
						}`}
						stroke={palette.goldLight}
						strokeWidth={6}
						strokeLinecap="round"
					/>
					<circle cx={155} cy={342} r={7} fill={ink} />
					<circle cx={357} cy={342} r={7} fill={ink} />
				</g>
			)}
			<LockPlate top={BODY_TOP + 14} />
			<path
				d={bodyPath}
				fill="none"
				stroke={ink}
				strokeWidth={style.stroke}
				strokeLinejoin="round"
			/>

			<g data-part="lid" transform={`translate(256 ${lidY}) rotate(${tilt})`}>
				<path d={LID_OUTLINE} fill={palette.teal} />
				<path
					d={`M86,${-LID_HEIGHT - 20}H${LID_HALF_WIDTH + 4}V2H70Z`}
					fill={palette.tealShade}
					clipPath={`url(#${id}-lid)`}
				/>
				{style.details && (
					<path
						d="M-128,-60H-86M32,-70H62"
						stroke={ink}
						strokeWidth={5}
						strokeLinecap="round"
						opacity={0.3}
					/>
				)}
				{LID_STRAPS.map(([left, right]) => (
					<path
						key={left}
						d={`M${left},-2V${-LID_HEIGHT + 2}H${right}V-2Z`}
						fill={palette.gold}
						stroke={ink}
						strokeWidth={8}
						strokeLinejoin="round"
						clipPath={`url(#${id}-lid)`}
					/>
				))}
				<path
					d={roundedPolygon([
						[-LID_HALF_WIDTH, -LID_BAND],
						[LID_HALF_WIDTH, -LID_BAND],
						[LID_HALF_WIDTH, 0],
						[-LID_HALF_WIDTH, 0],
					], 7)}
					fill={palette.gold}
					stroke={ink}
					strokeWidth={8}
					strokeLinejoin="round"
				/>
				{style.details && (
					<path
						d={`M-130,${-LID_HEIGHT + 16}Q-70,${-LID_HEIGHT + 4} -20,${
							-LID_HEIGHT + 2
						}`}
						fill="none"
						stroke={palette.white}
						strokeWidth={8}
						strokeLinecap="round"
						opacity={0.6}
					/>
				)}
				<path
					d={LID_OUTLINE}
					fill="none"
					stroke={ink}
					strokeWidth={style.stroke}
					strokeLinejoin="round"
				/>
			</g>

			{showSparkles && (
				<g fill={palette.gold} stroke={ink} strokeLinejoin="round">
					<path d={sparklePath(446, 184, 26)} strokeWidth={7} />
					<path d={sparklePath(420, 132, 13)} strokeWidth={5} />
				</g>
			)}
		</>
	);
}
