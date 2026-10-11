/**
 * Every exported logo file, rendered from the components. Shared by the
 * export script and the drift test.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
	ChestArt,
	ChestMark,
	chestTransform,
	Favicon,
	Logo,
	logoAspect,
	palette,
	REST_FRAME,
	Wordmark,
	WORDMARK_ASPECT,
} from "../src/index.ts";
import type { PdfPage } from "./pdf.ts";

export type BrandFile =
	| Readonly<{ kind: "svg"; path: string; svg: string }>
	| Readonly<{ kind: "png"; path: string; svg: string; width: number }>
	| Readonly<{ kind: "pdf"; path: string; svg: string; page: PdfPage }>;

/**
 * Standalone SVG markup. The file's name prefixes its clip and gradient ids,
 * so several files can be pasted into one document without clashing.
 */
const svg = (name: string, element: ReactElement) =>
	`${renderToStaticMarkup(element, { identifierPrefix: `${name}-` })}\n`;

/** Two decimals is far finer than any screen or press can show. */
const round = (value: number) => Math.round(value * 100) / 100;

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
			role="img"
			aria-label="lootbox"
		>
			<rect width={size} height={size} rx={radius} fill={ground} />
			<g transform={chestTransform(pad, pad, size - 2 * pad)}>
				<ChestArt sparkles={false} />
			</g>
		</svg>
	);
}

/** A logo as SVG plus the same drawing as a PDF page of the same size. */
function vector(
	name: string,
	title: string,
	width: number,
	height: number,
	draw: (size: Readonly<{ width: number; height: number }>) => ReactElement,
): BrandFile[] {
	const size = { width: round(width), height: round(height) };
	const markup = svg(name, draw(size));

	return [
		{ kind: "svg", path: `assets/logo/${name}.svg`, svg: markup },
		{
			kind: "pdf",
			path: `assets/logo/${name}.pdf`,
			svg: markup,
			page: { title, ...size },
		},
	];
}

export function brandFiles(): BrandFile[] {
	const horizontalHeight = 200;
	const stackedHeight = 320;
	const wordHeight = 120;
	const favicon = svg("favicon", <Favicon />);
	const boxToken = svg("box", <ChestMark size={512} look={REST_FRAME.look} />);

	return [
		...vector(
			"mark",
			"lootbox mark",
			512,
			512,
			({ width }) => <ChestMark size={width} title="lootbox" />,
		),
		...vector(
			"mark-compact",
			"lootbox mark, compact",
			512,
			512,
			({ width }) => (
				<ChestMark variant="compact" size={width} title="lootbox" />
			),
		),
		...vector(
			"wordmark",
			"lootbox wordmark",
			wordHeight * WORDMARK_ASPECT,
			wordHeight,
			(size) => <Wordmark {...size} />,
		),
		...vector(
			"wordmark-reverse",
			"lootbox wordmark, reverse",
			wordHeight * WORDMARK_ASPECT,
			wordHeight,
			(size) => <Wordmark {...size} color={palette.ivory} />,
		),
		...vector(
			"lockup-horizontal",
			"lootbox logo",
			horizontalHeight * logoAspect("horizontal"),
			horizontalHeight,
			(size) => <Logo {...size} />,
		),
		...vector(
			"lockup-horizontal-reverse",
			"lootbox logo, reverse",
			horizontalHeight * logoAspect("horizontal"),
			horizontalHeight,
			(size) => <Logo {...size} tone="dark" />,
		),
		...vector(
			"lockup-stacked",
			"lootbox logo, stacked",
			stackedHeight * logoAspect("stacked"),
			stackedHeight,
			(size) => <Logo {...size} layout="stacked" />,
		),
		{ kind: "svg", path: "assets/logo/favicon.svg", svg: favicon },
		{
			kind: "svg",
			path: "assets/icons/app-icon.svg",
			svg: svg("app-icon", <Tile size={1024} ground={palette.ivory} />),
		},
		{
			kind: "png",
			path: "assets/icons/app-icon-1024.png",
			svg: svg("app-icon", <Tile size={1024} ground={palette.ivory} />),
			width: 1024,
		},
		{
			kind: "png",
			path: "assets/icons/icon-512.png",
			svg: svg(
				"icon-512",
				<Tile size={512} ground={palette.ivory} radius={112} />,
			),
			width: 512,
		},
		{
			kind: "png",
			path: "assets/icons/icon-192.png",
			svg: svg(
				"icon-192",
				<Tile size={192} ground={palette.ivory} radius={42} />,
			),
			width: 192,
		},
		// The site's stand-in cover, and the image every box token shows on
		// lootbox.pina.rs and in the Unlisted series.
		{
			kind: "svg",
			path: "../../apps/platform/public/chest.svg",
			svg: svg(
				"chest",
				<ChestMark size={512} look={REST_FRAME.look} title="lootbox" />,
			),
		},
		{
			kind: "png",
			path: "../../apps/platform/public/box.png",
			svg: boxToken,
			width: 512,
		},
		{
			kind: "png",
			path: "../../apps/web/public/metadata/box.png",
			svg: boxToken,
			width: 512,
		},
		{
			kind: "svg",
			path: "../../apps/platform/public/favicon.svg",
			svg: favicon,
		},
		{
			kind: "png",
			path: "../../apps/platform/public/apple-touch-icon.png",
			svg: svg(
				"apple-touch-icon",
				<Tile size={180} ground={palette.ivory} inset={0.08} />,
			),
			width: 180,
		},
	];
}
