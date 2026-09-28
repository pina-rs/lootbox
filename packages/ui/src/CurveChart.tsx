/**
 * A box curve drawn as a staircase: one step per box, each a little taller
 * than the last. Sold boxes fill teal, and a pending buy or sell lights up
 * the boxes it would move. Everything is a prop, so a video can drive `sold`
 * frame by frame (fractions fill a step partway) and the site can animate it
 * with a CSS transition.
 */
import { useId } from "react";

import { formatSolAmount } from "./format.ts";

export type CurvePreview = Readonly<{
	side: "buy" | "sell";
	count: number;
}>;

export type CurveChartProps = Readonly<{
	inventory: number;
	/** Boxes sold. A fraction fills the next step partway, for animation. */
	sold: number;
	/** Lamports. */
	startPrice: number;
	/** Lamports per box. */
	priceStep: number;
	preview?: CurvePreview;
	/** Most steps drawn; larger curves draw one step per group of boxes. */
	maxSteps?: number;
	className?: string;
}>;

const WIDTH = 600;
const HEIGHT = 220;
const PAD_TOP = 34;
const PAD_BOTTOM = 28;
const PLOT = HEIGHT - PAD_TOP - PAD_BOTTOM;
/** The first step's share of the plot, so a flat curve still reads as boxes. */
const FLOOR = 0.28;

type Step = Readonly<{
	index: number;
	/** First box position in the step. */
	from: number;
	/** Boxes in the step. */
	size: number;
	height: number;
}>;

export function curveSteps(
	inventory: number,
	startPrice: number,
	priceStep: number,
	maxSteps: number,
): Step[] {
	const count = Math.max(1, Math.min(inventory, maxSteps));
	const size = inventory / count;
	const endPrice = startPrice + priceStep * Math.max(0, inventory - 1);

	return Array.from({ length: count }, (_, index) => {
		const from = Math.round(index * size);
		const next = Math.round((index + 1) * size);
		const middle = from + (next - from - 1) / 2;
		const price = startPrice + priceStep * middle;
		const rise = endPrice === startPrice
			? 0.5
			: (price - startPrice) / (endPrice - startPrice);

		return {
			index,
			from,
			size: next - from,
			height: PLOT * (FLOOR + (1 - FLOOR) * rise),
		};
	});
}

function fillOf(step: Step, boxes: number): number {
	return Math.min(1, Math.max(0, (boxes - step.from) / step.size));
}

export function CurveChart(
	{
		inventory,
		sold,
		startPrice,
		priceStep,
		preview,
		maxSteps = 60,
		className,
	}: CurveChartProps,
) {
	const clip = `lbx${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
	const steps = curveSteps(inventory, startPrice, priceStep, maxSteps);
	const gap = steps.length > 40 ? 1.5 : 3;
	const width = WIDTH / steps.length;
	const soldOut = sold >= inventory;
	const next = Math.min(Math.floor(sold), inventory - 1);
	const nextPrice = startPrice + priceStep * next;
	const endPrice = startPrice + priceStep * Math.max(0, inventory - 1);
	const previewFrom = preview?.side === "sell" ? sold - preview.count : sold;
	const previewTo = preview?.side === "sell"
		? sold
		: sold + (preview?.count ?? 0);
	const markerStep = steps.find((step) => next < step.from + step.size) ??
		steps.at(-1);
	const markerX = markerStep ? markerStep.index * width + width / 2 : WIDTH / 2;
	const markerY = markerStep ? PAD_TOP + PLOT - markerStep.height : PAD_TOP;
	const label = soldOut
		? `Sold out: all ${inventory} boxes sold. Prices rose from ${
			formatSolAmount(startPrice)
		} to ${formatSolAmount(endPrice)} SOL.`
		: `${Math.floor(sold)} of ${inventory} boxes sold. The next box costs ${
			formatSolAmount(nextPrice)
		} SOL; prices rise to ${formatSolAmount(endPrice)} SOL.`;

	return (
		<svg
			className={["curve-chart", className].filter(Boolean).join(" ")}
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			role="img"
			aria-label={label}
			data-sold-out={soldOut || undefined}
		>
			<defs>
				<clipPath id={clip}>
					<rect x={0} y={0} width={WIDTH} height={PAD_TOP + PLOT} />
				</clipPath>
			</defs>
			<line
				className="curve-chart-base"
				x1={0}
				x2={WIDTH}
				y1={PAD_TOP + PLOT}
				y2={PAD_TOP + PLOT}
			/>
			<g clipPath={`url(#${clip})`}>
				{steps.map((step) => {
					const x = step.index * width + gap / 2;
					const y = PAD_TOP + PLOT - step.height;
					const filled = fillOf(step, sold);
					const lit = preview && preview.count > 0
						? fillOf(step, previewTo) - fillOf(step, previewFrom)
						: 0;
					const litFrom = preview?.side === "sell"
						? fillOf(step, previewFrom)
						: filled;

					return (
						<g key={step.index} className="curve-chart-step">
							<rect
								className="curve-chart-box"
								x={x}
								y={y}
								width={width - gap}
								height={step.height}
								rx={Math.min(4, width / 4)}
							/>
							{filled > 0 && (
								<rect
									className="curve-chart-sold"
									x={x}
									y={y + step.height * (1 - filled)}
									width={width - gap}
									height={step.height * filled}
									rx={Math.min(4, width / 4)}
								/>
							)}
							{lit > 0 && (
								<rect
									className="curve-chart-preview"
									data-side={preview?.side}
									x={x}
									y={y + step.height * (1 - litFrom - lit)}
									width={width - gap}
									height={step.height * lit}
									rx={Math.min(4, width / 4)}
								/>
							)}
						</g>
					);
				})}
			</g>
			{!soldOut && (
				<g
					className="curve-chart-marker"
					transform={`translate(${markerX} ${markerY - 8})`}
				>
					<path d="M-7,-10 L7,-10 L0,0 Z" />
					<text y={-16} textAnchor={markerX > WIDTH - 90 ? "end" : "middle"}>
						{formatSolAmount(nextPrice)} SOL
					</text>
				</g>
			)}
			<text className="curve-chart-axis" x={0} y={HEIGHT - 8}>
				Box 1 · {formatSolAmount(startPrice)} SOL
			</text>
			<text
				className="curve-chart-axis"
				x={WIDTH}
				y={HEIGHT - 8}
				textAnchor="end"
			>
				Box {inventory} · {formatSolAmount(endPrice)} SOL
			</text>
		</svg>
	);
}
