/**
 * Alternative B, "The chest's story": the mascot explains lootbox in its own
 * voice, square for any feed, cut to `treasure-hop` (116 BPM, 62 frames a
 * bar).
 */
import { Sequence, useVideoConfig } from "remotion";

import { Bubble } from "../kit/Bubble.tsx";
import { beat } from "../kit/motion.ts";
import { Paper } from "../kit/Paper.tsx";
import { Music } from "../kit/Sound.tsx";
import { Wipe } from "../kit/Wipe.tsx";
import { EndCard } from "../scenes/EndCard.tsx";
import { LockIn } from "../scenes/LockIn.tsx";
import {
	StoryCopies,
	StoryHello,
	StoryOpen,
	StoryStaircase,
} from "../scenes/Story.tsx";

const BAR = beat(116, 4);
const CUT = {
	fill: Math.round(BAR * 2),
	copies: Math.round(BAR * 4.5),
	stairs: Math.round(BAR * 6.5),
	open: Math.round(BAR * 8.5),
	end: Math.round(BAR * 11.5),
} as const;
export const STORY_FRAMES = CUT.end + 110;

function FillBubbles() {
	const { width, height } = useVideoConfig();

	return (
		<>
			<Bubble
				text="Fill me with real prizes."
				at={6}
				until={92}
				x={width * 0.06}
				y={height * 0.06}
				width={width * 0.5}
				size={height * 0.048}
				tail="right"
			/>
			<Bubble
				text="Locked in. Nobody can take them back."
				at={112}
				until={CUT.copies - CUT.fill}
				x={width * 0.06}
				y={height * 0.06}
				width={width * 0.52}
				size={height * 0.046}
				tail="right"
			/>
		</>
	);
}

export function Story() {
	return (
		<Paper>
			<Sequence durationInFrames={CUT.fill}>
				<StoryHello />
			</Sequence>
			<Sequence from={CUT.fill} durationInFrames={CUT.copies - CUT.fill}>
				<LockIn caption={null} stamp={false} />
				<FillBubbles />
			</Sequence>
			<Sequence from={CUT.copies} durationInFrames={CUT.stairs - CUT.copies}>
				<StoryCopies />
			</Sequence>
			<Sequence from={CUT.stairs} durationInFrames={CUT.open - CUT.stairs}>
				<StoryStaircase />
			</Sequence>
			<Sequence from={CUT.open} durationInFrames={CUT.end - CUT.open}>
				<StoryOpen />
			</Sequence>
			<Sequence from={CUT.end}>
				<EndCard />
			</Sequence>
			{[CUT.fill, CUT.copies, CUT.stairs, CUT.open, CUT.end].map((cut) => (
				<Wipe key={cut} at={cut} />
			))}
			<Music
				track="treasure-hop"
				durationInFrames={STORY_FRAMES}
				fadeOut={40}
				volume={0.7}
			/>
		</Paper>
	);
}
