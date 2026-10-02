/**
 * "Fill it": the creator's side in 24 seconds, cut to `treasure-hop-30`.
 * Scenes change on the downbeat of a bar (116 BPM, 62 frames a bar).
 */
import { Sequence } from "remotion";

import { beat } from "../kit/motion.ts";
import { Paper } from "../kit/Paper.tsx";
import { Music } from "../kit/Sound.tsx";
import { Wipe } from "../kit/Wipe.tsx";
import { Builder } from "../scenes/Builder.tsx";
import { Collectibles } from "../scenes/Collectibles.tsx";
import { EndCard } from "../scenes/EndCard.tsx";
import { Hook } from "../scenes/Hook.tsx";
import { LockIn } from "../scenes/LockIn.tsx";

const BAR = beat(116, 4);
const CUT = {
	builder: Math.round(BAR * 2),
	collectibles: Math.round(BAR * 6),
	lock: Math.round(BAR * 7.5),
	end: Math.round(BAR * 10),
} as const;
export const FILL_IT_FRAMES = Math.round(BAR * 10) + 105;

export function FillIt() {
	return (
		<Paper>
			<Sequence durationInFrames={CUT.builder}>
				<Hook
					beat={beat(116)}
					lines={[
						["Put", { text: "real prizes", underline: true }],
						["in", "a", "box"],
					]}
				/>
			</Sequence>
			<Sequence
				from={CUT.builder}
				durationInFrames={CUT.collectibles - CUT.builder}
			>
				<Builder />
			</Sequence>
			<Sequence
				from={CUT.collectibles}
				durationInFrames={CUT.lock - CUT.collectibles}
			>
				<Collectibles />
			</Sequence>
			<Sequence from={CUT.lock} durationInFrames={CUT.end - CUT.lock}>
				<LockIn />
			</Sequence>
			<Sequence from={CUT.end}>
				<EndCard />
			</Sequence>
			{[CUT.builder, CUT.collectibles, CUT.lock, CUT.end].map((cut) => (
				<Wipe key={cut} at={cut} />
			))}
			<Music
				track="treasure-hop-30"
				durationInFrames={FILL_IT_FRAMES}
				fadeOut={30}
				volume={0.75}
			/>
		</Paper>
	);
}
