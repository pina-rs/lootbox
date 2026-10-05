/**
 * "Hand it out": airdrops and box curves in 34 seconds, cut to
 * `big-reveal` (124 BPM). The build carries the airdrop; the impact lands
 * the curve; the drop sells it out.
 */
import { Sequence } from "remotion";

import { beat } from "../kit/motion.ts";
import { Paper } from "../kit/Paper.tsx";
import { Music } from "../kit/Sound.tsx";
import { Wipe } from "../kit/Wipe.tsx";
import { Airdrop } from "../scenes/Airdrop.tsx";
import { CurveSale } from "../scenes/CurveSale.tsx";
import { EndCard } from "../scenes/EndCard.tsx";
import { TwoWays } from "../scenes/TwoWays.tsx";

const BAR = beat(124, 4);
const CUT = {
	airdrop: Math.round(BAR * 4),
	curve: Math.round(BAR * 8),
	end: Math.round(BAR * 16),
} as const;
export const HAND_IT_OUT_FRAMES = CUT.end + 90;

export function HandItOut() {
	return (
		<Paper>
			<Sequence durationInFrames={CUT.airdrop}>
				<TwoWays beat={beat(124)} />
			</Sequence>
			<Sequence from={CUT.airdrop} durationInFrames={CUT.curve - CUT.airdrop}>
				<Airdrop />
			</Sequence>
			<Sequence from={CUT.curve} durationInFrames={CUT.end - CUT.curve}>
				<CurveSale />
			</Sequence>
			<Sequence from={CUT.end}>
				<EndCard line="Hand yours out at" />
			</Sequence>
			{[CUT.airdrop, CUT.curve, CUT.end].map((cut) => (
				<Wipe key={cut} at={cut} />
			))}
			<Music
				track="big-reveal"
				durationInFrames={HAND_IT_OUT_FRAMES}
				volume={0.7}
			/>
		</Paper>
	);
}
