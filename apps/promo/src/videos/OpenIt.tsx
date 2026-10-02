/**
 * "Open it": the holder's side in 15 seconds, vertical for phones, cut to
 * `treasure-hop-15`. The end card lands on the track's button hit.
 */
import { Sequence } from "remotion";

import { Paper } from "../kit/Paper.tsx";
import { Music } from "../kit/Sound.tsx";
import { Wipe } from "../kit/Wipe.tsx";
import { EndCard } from "../scenes/EndCard.tsx";
import { OPEN_FRAMES, OpenOnPhone } from "../scenes/OpenOnPhone.tsx";

export const OPEN_IT_FRAMES = OPEN_FRAMES + 90;

export function OpenIt() {
	return (
		<Paper>
			<Sequence durationInFrames={OPEN_FRAMES}>
				<OpenOnPhone />
			</Sequence>
			<Sequence from={OPEN_FRAMES}>
				<EndCard line="Open one at" />
			</Sequence>
			<Wipe at={OPEN_FRAMES} />
			<Music
				track="treasure-hop-15"
				durationInFrames={OPEN_IT_FRAMES}
				volume={0.7}
			/>
		</Paper>
	);
}
