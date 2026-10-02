/**
 * The ground every video stands on: the site's warm ivory with a faint dot
 * grid and a soft vignette, so a frame reads as lootbox before anything moves.
 */
import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";

export type Ground = "ivory" | "ink" | "teal";

const GROUNDS: Record<Ground, { base: string; dot: string; vignette: string }> =
	{
		ivory: {
			base: "var(--ivory)",
			dot: "rgb(29 26 20 / 0.07)",
			vignette: "rgb(120 90 40 / 0.14)",
		},
		ink: {
			base: "var(--ink)",
			dot: "rgb(243 237 218 / 0.06)",
			vignette: "rgb(0 0 0 / 0.5)",
		},
		teal: {
			base: "var(--teal-deep)",
			dot: "rgb(243 237 218 / 0.08)",
			vignette: "rgb(0 0 0 / 0.35)",
		},
	};

export function Paper(
	{ ground = "ivory", children, drift = 0 }: Readonly<{
		ground?: Ground;
		children?: ReactNode;
		/** Grid offset in pixels, for a slow parallax drift. */
		drift?: number;
	}>,
) {
	const tone = GROUNDS[ground];

	return (
		<AbsoluteFill style={{ background: tone.base }}>
			<AbsoluteFill
				style={{
					backgroundImage:
						`radial-gradient(${tone.dot} 2px, transparent 2.5px)`,
					backgroundSize: "36px 36px",
					backgroundPosition: `${drift}px ${drift * 0.6}px`,
				}}
			/>
			<AbsoluteFill
				style={{
					background:
						`radial-gradient(ellipse at center, transparent 55%, ${tone.vignette} 100%)`,
				}}
			/>
			{children}
		</AbsoluteFill>
	);
}
