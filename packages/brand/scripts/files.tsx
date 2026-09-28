/**
 * Every exported logo file, rendered from the components. Shared by the
 * export script and the drift test.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
	ChestMark,
	Favicon,
	Logo,
	logoAspect,
	palette,
	Wordmark,
	WORDMARK_ASPECT,
} from "../src/index.ts";

export type BrandFile =
	| Readonly<{ kind: "svg"; path: string; svg: string }>
	| Readonly<{ kind: "png"; path: string; svg: string; width: number }>;

const svg = (element: ReactElement) => `${renderToStaticMarkup(element)}\n`;

/** A square tile with the mark centred on a solid ground. */
function Tile(
	{ size, ground, radius = 0, inset = 0.1 }: Readonly<{
		size: number;
		ground: string;
		radius?: number;
		inset?: number;
	}>,
) {
	const pad = size * inset;

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={`0 0 ${size} ${size}`}
			width={size}
			height={size}
		>
			<rect width={size} height={size} rx={radius} fill={ground} />
			<ChestMark x={pad} y={pad} size={size - 2 * pad} sparkles={false} />
		</svg>
	);
}

export function brandFiles(): BrandFile[] {
	const horizontalHeight = 200;
	const stackedHeight = 320;
	const wordHeight = 120;
	const favicon = svg(<Favicon />);

	return [
		{
			kind: "svg",
			path: "assets/logo/mark.svg",
			svg: svg(<ChestMark size={512} title="lootbox" />),
		},
		{
			kind: "svg",
			path: "assets/logo/mark-compact.svg",
			svg: svg(<ChestMark variant="compact" size={512} title="lootbox" />),
		},
		{
			kind: "svg",
			path: "assets/logo/wordmark.svg",
			svg: svg(
				<Wordmark height={wordHeight} width={wordHeight * WORDMARK_ASPECT} />,
			),
		},
		{
			kind: "svg",
			path: "assets/logo/wordmark-reverse.svg",
			svg: svg(
				<Wordmark
					height={wordHeight}
					width={wordHeight * WORDMARK_ASPECT}
					color={palette.ivory}
				/>,
			),
		},
		{
			kind: "svg",
			path: "assets/logo/lockup-horizontal.svg",
			svg: svg(
				<Logo
					height={horizontalHeight}
					width={horizontalHeight * logoAspect("horizontal")}
				/>,
			),
		},
		{
			kind: "svg",
			path: "assets/logo/lockup-horizontal-reverse.svg",
			svg: svg(
				<Logo
					tone="dark"
					height={horizontalHeight}
					width={horizontalHeight * logoAspect("horizontal")}
				/>,
			),
		},
		{
			kind: "svg",
			path: "assets/logo/lockup-stacked.svg",
			svg: svg(
				<Logo
					layout="stacked"
					height={stackedHeight}
					width={stackedHeight * logoAspect("stacked")}
				/>,
			),
		},
		{ kind: "svg", path: "assets/logo/favicon.svg", svg: favicon },
		{
			kind: "png",
			path: "assets/icons/app-icon-1024.png",
			svg: svg(<Tile size={1024} ground={palette.ivory} />),
			width: 1024,
		},
		{
			kind: "png",
			path: "assets/icons/icon-512.png",
			svg: svg(<Tile size={512} ground={palette.ivory} radius={112} />),
			width: 512,
		},
		{
			kind: "png",
			path: "assets/icons/icon-192.png",
			svg: svg(<Tile size={192} ground={palette.ivory} radius={42} />),
			width: 192,
		},
		{
			kind: "svg",
			path: "../../apps/platform/public/favicon.svg",
			svg: favicon,
		},
		{
			kind: "png",
			path: "../../apps/platform/public/apple-touch-icon.png",
			svg: svg(<Tile size={180} ground={palette.ivory} inset={0.08} />),
			width: 180,
		},
	];
}
