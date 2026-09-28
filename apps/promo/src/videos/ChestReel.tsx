/**
 * The chest's whole performance on the site, one column per reaction: idle,
 * held until charged, waiting on the chain, the reveal, and the pose it
 * keeps. Every frame comes from the brand's motion, the same functions the
 * site's open flow plays, so this is the reference for both.
 */
import type { ChestReaction } from "@pina-rs/lootbox-brand";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import { Chest } from "../kit/Chest.tsx";
import { chestFlowFrame } from "../kit/chestFlow.ts";
import { FPS } from "../kit/motion.ts";
import { Paper } from "../kit/Paper.tsx";

const HOLD_AT = 2.5;
const HOLD_SECONDS = 1.2;
const WAIT_AT = HOLD_AT + HOLD_SECONDS;
const REVEAL_AT = WAIT_AT + 1.6;

export const CHEST_REEL_FRAMES = Math.round((REVEAL_AT + 5) * FPS);

const COLUMNS: readonly Readonly<{ reaction: ChestReaction; label: string }>[] =
	[
		{ reaction: "big-prize", label: "Big prize" },
		{ reaction: "small-prize", label: "Small prize" },
		{ reaction: "disappointed", label: "Nothing big" },
	];

function phaseLabel(t: number): string {
	if (t < HOLD_AT) return "Waiting for you";
	if (t < WAIT_AT) return "Held down";
	if (t < REVEAL_AT) return "Drawing the prize";

	return "Revealed";
}

export function ChestReel() {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const t = frame / FPS;
	const size = Math.min(width / 4, height * 0.5);

	return (
		<Paper>
			<AbsoluteFill>
				<div
					style={{
						position: "absolute",
						top: height * 0.07,
						width: "100%",
						textAlign: "center",
						font: `400 ${height * 0.05}px/1 var(--display)`,
						textTransform: "uppercase",
					}}
				>
					{phaseLabel(t)}
				</div>
				{COLUMNS.map(({ reaction, label }, index) => {
					const x = (width / 6) * (1 + index * 2);

					return (
						<div key={reaction}>
							<Chest
								x={x}
								y={height * 0.72}
								size={size}
								frame={chestFlowFrame(
									{
										holdAt: HOLD_AT,
										waitAt: WAIT_AT,
										revealAt: REVEAL_AT,
										reaction,
									},
									t,
								)}
							/>
							<div
								style={{
									position: "absolute",
									left: x - size / 2,
									width: size,
									top: height * 0.82,
									textAlign: "center",
									font: `900 ${height * 0.032}px/1 var(--body)`,
									color: "var(--ink-soft)",
								}}
							>
								{label}
							</div>
						</div>
					);
				})}
			</AbsoluteFill>
		</Paper>
	);
}
