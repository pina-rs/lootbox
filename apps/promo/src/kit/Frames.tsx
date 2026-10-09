/**
 * Device frames in the site's ink-and-paper style: a browser window showing
 * lootbox.pina.rs, and a phone. Their contents are real site components.
 */
import { ChestMark, Wordmark } from "@pina-rs/lootbox-brand";
import type { CSSProperties, ReactNode } from "react";

export function BrowserFrame(
	{ url, width, height, children, style }: Readonly<{
		url: string;
		width: number;
		height: number;
		children: ReactNode;
		style?: CSSProperties;
	}>,
) {
	return (
		<div
			style={{
				position: "absolute",
				width,
				height,
				border: "5px solid var(--ink)",
				borderRadius: 28,
				background: "var(--ivory)",
				boxShadow: "0 14px 0 var(--ink)",
				overflow: "hidden",
				...style,
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 14,
					height: 64,
					padding: "0 22px",
					borderBottom: "4px solid var(--ink)",
					background: "var(--paper)",
				}}
			>
				{["var(--lock)", "var(--gold)", "var(--teal-bright)"].map((color) => (
					<span
						key={color}
						style={{
							width: 20,
							height: 20,
							borderRadius: "50%",
							border: "3px solid var(--ink)",
							background: color,
						}}
					/>
				))}
				<span
					style={{
						flex: 1,
						marginLeft: 18,
						padding: "8px 22px",
						border: "3px solid var(--ink)",
						borderRadius: 999,
						background: "var(--white)",
						font: "800 24px/1 var(--body)",
						color: "var(--ink-soft)",
					}}
				>
					{url}
				</span>
			</div>
			<div
				style={{
					position: "relative",
					height: height - 64,
					overflow: "hidden",
				}}
			>
				{children}
			</div>
		</div>
	);
}

/** The site's top bar, as a static strip for frames. */
export function SiteBar({ scale = 1 }: Readonly<{ scale?: number }>) {
	return (
		<header
			className="topbar"
			style={{ position: "relative", fontSize: 16 * scale }}
		>
			<div className="topbar-inner" style={{ maxInlineSize: "none" }}>
				<span className="brand">
					<ChestMark
						className="brand-mark"
						variant="compact"
						size={38 * scale}
					/>
					<Wordmark className="brand-word" height={17 * scale} title="" />
				</span>
				<nav className="topnav" aria-label="Main">
					<a>Explore</a>
					<a className="active">Create</a>
				</nav>
			</div>
		</header>
	);
}

export function PhoneFrame(
	{ width, children, style }: Readonly<{
		width: number;
		children: ReactNode;
		style?: CSSProperties;
	}>,
) {
	const height = width * 2.05;

	return (
		<div
			style={{
				position: "absolute",
				width,
				height,
				padding: 18,
				border: "6px solid var(--ink)",
				borderRadius: 70,
				background: "var(--ink)",
				boxShadow: "0 16px 0 rgb(29 26 20 / 0.35)",
				...style,
			}}
		>
			<div
				style={{
					position: "relative",
					width: "100%",
					height: "100%",
					borderRadius: 52,
					background: "var(--ivory)",
					overflow: "hidden",
				}}
			>
				{children}
				<div
					style={{
						position: "absolute",
						top: 16,
						left: "50%",
						width: 140,
						height: 38,
						marginLeft: -70,
						borderRadius: 999,
						background: "var(--ink)",
					}}
				/>
			</div>
		</div>
	);
}

/**
 * Site content laid out at a real browser width, then scaled to fill its
 * frame, so pages keep their true proportions and stay legible on video.
 */
export function SiteViewport(
	{ cssWidth, width, height, children, scroll = 0 }: Readonly<{
		cssWidth: number;
		width: number;
		height: number;
		children: ReactNode;
		/** Scroll offset in CSS pixels. */
		scroll?: number;
	}>,
) {
	const scale = width / cssWidth;

	return (
		<div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
			<div
				style={{
					position: "relative",
					width: cssWidth,
					minHeight: height / scale,
					transform: `scale(${scale}) translateY(${-scroll}px)`,
					transformOrigin: "top left",
					background: "var(--ivory)",
					font: "500 16px/1.55 var(--body)",
					color: "var(--ink)",
				}}
			>
				{children}
			</div>
		</div>
	);
}
