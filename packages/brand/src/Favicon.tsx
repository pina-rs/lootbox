/**
 * The mark redrawn on a 32 px grid for favicons and tiny avatars. Scaling the
 * full mark down loses the eyes, so this version keeps only the silhouette,
 * the lock, and two oversized eyes, with outlines sized to whole pixels.
 */
import type { SVGProps } from "react";

import { palette } from "./tokens.ts";

export type FaviconProps =
	& Readonly<{
		/** Draw the ivory tile behind the chest. Off for transparent use. */
		tile?: boolean;
		size?: number | string;
	}>
	& Omit<SVGProps<SVGSVGElement>, "children" | "viewBox" | "width" | "height">;

export function Favicon({ tile = true, size, ...svg }: FaviconProps) {
	const { ink } = palette;

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 32 32"
			width={size}
			height={size}
			aria-hidden
			{...svg}
		>
			{tile && (
				<rect
					x={0.5}
					y={0.5}
					width={31}
					height={31}
					rx={8}
					fill={palette.ivory}
				/>
			)}
			<path d="M5.5 16L6.5 8H25.5L26.5 16Z" fill={palette.inside} />
			<ellipse cx={12.6} cy={12.6} rx={2.5} ry={3.1} fill={palette.white} />
			<ellipse cx={19.4} cy={12.6} rx={2.5} ry={3.1} fill={palette.white} />
			<ellipse cx={13.3} cy={12.4} rx={1.35} ry={1.9} fill={ink} />
			<ellipse cx={20.1} cy={12.4} rx={1.35} ry={1.9} fill={ink} />
			<path
				d="M4.5 16H27.5L26.5 28H5.5Z"
				fill={palette.teal}
				stroke={ink}
				strokeWidth={2}
				strokeLinejoin="round"
			/>
			<path
				d="M4.7 16H27.3L27.1 19H4.9Z"
				fill={palette.gold}
				stroke={ink}
				strokeWidth={1.5}
				strokeLinejoin="round"
			/>
			<path
				d="M13.5 17.5H18.5V22.6L16 24.4L13.5 22.6Z"
				fill={palette.coral}
				stroke={ink}
				strokeWidth={1.5}
				strokeLinejoin="round"
			/>
			<g transform="rotate(-9 16 8)">
				<path
					d="M4 9.2V5.8Q4 3 7.5 2.7Q16 1.8 24.5 2.7Q28 3 28 5.8V9.2Z"
					fill={palette.teal}
					stroke={ink}
					strokeWidth={2}
					strokeLinejoin="round"
				/>
				<path
					d="M4.2 6.8H27.8V9.2H4.2Z"
					fill={palette.gold}
					stroke={ink}
					strokeWidth={1.5}
					strokeLinejoin="round"
				/>
			</g>
		</svg>
	);
}
