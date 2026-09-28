/**
 * The first two seconds: a big promise, word by word, while the chest peeks
 * up from the bottom of the frame to read it.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import { Chest } from "../kit/Chest.tsx";
import { blinks, BOUNCE, enter, mix } from "../kit/motion.ts";
import { Headline, type Word } from "../kit/Type.tsx";

export function Hook(
	{ lines, beat = 15.5 }: Readonly<{
		lines: readonly (readonly (string | Word)[])[];
		/** Frames per music beat; words land on beats. */
		beat?: number;
	}>,
) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const tall = height > width;
	const size = tall ? width * 0.13 : height * 0.15;
	const chestSize = tall ? width * 0.7 : height * 0.55;
	const rise = enter(frame, beat * 2.5, BOUNCE);
	let index = 0;

	return (
		<AbsoluteFill>
			<div
				style={{
					position: "absolute",
					top: tall ? height * 0.22 : height * 0.16,
					left: 0,
					right: 0,
					display: "grid",
					gap: size * 0.1,
				}}
			>
				{lines.map((line, lineIndex) => {
					const start = index;

					index += line.length;

					return (
						<Headline
							key={lineIndex}
							words={line}
							at={start * (beat / 2)}
							stagger={beat / 2}
							size={size}
							width={width}
						/>
					);
				})}
			</div>
			<Chest
				x={width / 2}
				y={height + chestSize * mix(0.9, 0.28, Math.min(1.1, rise))}
				size={chestSize}
				open={mix(0, 1.1, Math.min(1, rise))}
				look={{ x: 0, y: -1 }}
				blink={blinks(frame, [beat * 5.5])}
				sparkles
			/>
		</AbsoluteFill>
	);
}
