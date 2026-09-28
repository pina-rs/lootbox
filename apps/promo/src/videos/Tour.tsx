/**
 * Alternative A, "Product tour": every feature in the real UI, unhurried,
 * over the `vault-lofi` bed (84 BPM). Scenes cut on bar lines.
 */
import type { ReactElement } from "react";
import { Sequence } from "remotion";

import { beat } from "../kit/motion.ts";
import { Paper } from "../kit/Paper.tsx";
import { Music } from "../kit/Sound.tsx";
import { Caption } from "../kit/Type.tsx";
import { Wipe } from "../kit/Wipe.tsx";
import { Airdrop, AIRDROP_FRAMES } from "../scenes/Airdrop.tsx";
import { Builder, BUILDER_FRAMES } from "../scenes/Builder.tsx";
import { COLLECTIBLE_FRAMES, Collectibles } from "../scenes/Collectibles.tsx";
import { CURVE_FRAMES, CurveSale } from "../scenes/CurveSale.tsx";
import { EndCard } from "../scenes/EndCard.tsx";
import { Hook } from "../scenes/Hook.tsx";
import { LOCK_FRAMES, LockIn } from "../scenes/LockIn.tsx";
import { OPEN_FRAMES, OpenOnPhone } from "../scenes/OpenOnPhone.tsx";
import { TwoWays } from "../scenes/TwoWays.tsx";

const BEAT = beat(84);
const HOOK = Math.round(BEAT * 8);

type Shot = Readonly<{ key: string; frames: number; element: ReactElement }>;

const SHOTS: readonly Shot[] = [
	{
		key: "hook",
		frames: HOOK,
		element: (
			<Hook
				beat={BEAT}
				lines={[
					["Real", "prizes."],
					["Sealed", "in", "a", { text: "box", underline: true }],
				]}
			/>
		),
	},
	{ key: "builder", frames: BUILDER_FRAMES, element: <Builder /> },
	{
		key: "collectibles",
		frames: COLLECTIBLE_FRAMES,
		element: <Collectibles />,
	},
	{ key: "lock", frames: LOCK_FRAMES, element: <LockIn /> },
	{ key: "ways", frames: 232, element: <TwoWays beat={BEAT * 0.7} /> },
	{
		key: "airdrop",
		frames: AIRDROP_FRAMES,
		element: (
			<>
				<Airdrop />
				<Caption
					text="Airdrop to a list. You cover the fees."
					at={24}
					until={AIRDROP_FRAMES - 6}
					size={42}
					bottom={50}
				/>
			</>
		),
	},
	{ key: "curve", frames: CURVE_FRAMES, element: <CurveSale /> },
	{ key: "open", frames: OPEN_FRAMES, element: <OpenOnPhone /> },
	{ key: "end", frames: 120, element: <EndCard /> },
];

const STARTS = SHOTS.reduce<number[]>((starts, shot, index) => {
	starts.push(
		index === 0
			? 0
			: (starts[index - 1] ?? 0) + (SHOTS[index - 1]?.frames ?? 0),
	);

	return starts;
}, []);

export const TOUR_FRAMES = SHOTS.reduce((sum, shot) => sum + shot.frames, 0);

export function Tour() {
	return (
		<Paper>
			{SHOTS.map((shot, index) => (
				<Sequence
					key={shot.key}
					from={STARTS[index] ?? 0}
					durationInFrames={shot.frames}
				>
					{shot.element}
				</Sequence>
			))}
			{STARTS.slice(1).map((at) => <Wipe key={at} at={at} />)}
			<Music
				track="vault-lofi"
				durationInFrames={TOUR_FRAMES}
				fadeOut={45}
				volume={0.55}
			/>
		</Paper>
	);
}
