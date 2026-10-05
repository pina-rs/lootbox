/**
 * Spot illustrations for the two ways boxes leave a creator's hands, drawn
 * in the chest's ink-and-gold style on a 64-unit grid.
 */
import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "viewBox">;

const INK = "var(--ink)";

function MiniChest({ x, y }: Readonly<{ x: number; y: number }>) {
	return (
		<g transform={`translate(${x} ${y})`}>
			<rect
				x={-9}
				y={-3}
				width={18}
				height={12}
				rx={2}
				fill="var(--teal-bright)"
				stroke={INK}
				strokeWidth={2.2}
			/>
			<path
				d="M-9.5,-3 V-7 Q-9.5,-10 -6.5,-10 H6.5 Q9.5,-10 9.5,-7 V-3 Z"
				fill="var(--teal-bright)"
				stroke={INK}
				strokeWidth={2.2}
				strokeLinejoin="round"
			/>
			<path d="M-9,-3 H9" stroke="var(--gold)" strokeWidth={2.4} />
			<rect
				x={-2.5}
				y={-5}
				width={5}
				height={6}
				rx={1}
				fill="var(--lock)"
				stroke={INK}
				strokeWidth={1.4}
			/>
		</g>
	);
}

/** Boxes fanning out from one chest to three wallets. */
export function AirdropIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
			<path
				d="M22,34 C30,22 40,14 52,12 M22,34 C34,32 44,32 54,34 M22,34 C30,44 40,52 52,56"
				fill="none"
				stroke={INK}
				strokeWidth={2.2}
				strokeLinecap="round"
				strokeDasharray="3 4"
			/>
			{[[52, 12], [55, 34], [52, 56]].map(([x = 0, y = 0]) => (
				<circle
					key={`${x}-${y}`}
					cx={x}
					cy={y}
					r={5.5}
					fill="var(--gold)"
					stroke={INK}
					strokeWidth={2.2}
				/>
			))}
			<MiniChest x={16} y={36} />
		</svg>
	);
}

/** A rising staircase of boxes with a coin on the next step. */
export function CurveIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
			{[0, 1, 2, 3, 4].map((step) => (
				<rect
					key={step}
					x={6 + step * 11}
					y={50 - (10 + step * 7)}
					width={9}
					height={10 + step * 7}
					rx={2}
					fill={step < 3 ? "var(--teal-bright)" : "var(--paper)"}
					stroke={INK}
					strokeWidth={2.2}
				/>
			))}
			<circle
				cx={44.5}
				cy={22}
				r={5}
				fill="var(--gold)"
				stroke={INK}
				strokeWidth={2.2}
			/>
			<path
				d="M4,54 H60"
				stroke={INK}
				strokeWidth={2.2}
				strokeLinecap="round"
			/>
		</svg>
	);
}
