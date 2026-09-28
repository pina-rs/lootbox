/**
 * Alternative C, "Hype": 15 vertical seconds for the timeline. Word slams
 * on the beat, then fast cuts, over the drop of `big-reveal` (124 BPM).
 */
import { Sequence } from "remotion";

import { beat } from "../kit/motion.ts";
import { Paper } from "../kit/Paper.tsx";
import { Music } from "../kit/Sound.tsx";
import { Wipe } from "../kit/Wipe.tsx";
import { Collectibles } from "../scenes/Collectibles.tsx";
import { EndCard } from "../scenes/EndCard.tsx";
import { LockIn } from "../scenes/LockIn.tsx";
import { OpenOnPhone } from "../scenes/OpenOnPhone.tsx";
import { Slam } from "../scenes/Slam.tsx";

const BEAT = beat(124);
const BAR = BEAT * 4;
/** The impact that starts the drop, in frames into the track. */
const DROP = Math.round(BAR * 8);
const CUT = {
	lock: Math.round(BAR),
	collectibles: Math.round(BAR * 3),
	open: Math.round(BAR * 4.5),
	end: Math.round(BAR * 6.5),
} as const;
/** Where the phone scene is when the hype cut joins it: mid-hold. */
const OPEN_FROM = 100;
export const HYPE_FRAMES = 450;

export function Hype() {
	return (
		<Paper>
			<Sequence durationInFrames={CUT.lock}>
				<Slam
					beat={BEAT}
					words={[
						{ text: "Real", ground: "var(--ivory)", ink: "var(--ink)" },
						{ text: "prizes", ground: "var(--teal)", ink: "var(--ivory)" },
						{ text: "in a", ground: "var(--gold)", ink: "var(--ink)" },
						{ text: "box", ground: "var(--ink)", ink: "var(--gold)" },
					]}
				/>
			</Sequence>
			<Sequence from={CUT.lock} durationInFrames={CUT.collectibles - CUT.lock}>
				<LockIn caption="Every prize locked on chain" />
			</Sequence>
			<Sequence
				from={CUT.collectibles}
				durationInFrames={CUT.open - CUT.collectibles}
			>
				<Collectibles headline={["Nobody", "loses"]} />
			</Sequence>
			<Sequence from={CUT.open} durationInFrames={CUT.end - CUT.open}>
				<Sequence from={-OPEN_FROM}>
					<OpenOnPhone />
				</Sequence>
			</Sequence>
			<Sequence from={CUT.end}>
				<EndCard line="Try it at" />
			</Sequence>
			{[CUT.lock, CUT.collectibles, CUT.open, CUT.end].map((cut) => (
				<Wipe key={cut} at={cut} />
			))}
			<Music
				track="big-reveal"
				trimBefore={DROP}
				durationInFrames={HYPE_FRAMES}
				fadeOut={24}
				volume={0.75}
			/>
		</Paper>
	);
}
