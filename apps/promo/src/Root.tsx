/**
 * Every composition. Ids are `<video>-<shape>`: `wide` is 1920×1080 for X
 * and YouTube, `square` 1080×1080, `tall` 1080×1920 for phones.
 */
import "./styles.css";

import { Composition, Still } from "remotion";

import { FPS } from "./kit/motion.ts";
import { Avatar, Banner, ShareCard } from "./stills/Social.tsx";
import { CHEST_REEL_FRAMES, ChestReel } from "./videos/ChestReel.tsx";
import { CreatorCut, scriptCut } from "./videos/CreatorCut.tsx";
import { FILL_IT_FRAMES, FillIt } from "./videos/FillIt.tsx";
import { HAND_IT_OUT_FRAMES, HandItOut } from "./videos/HandItOut.tsx";
import { Hype, HYPE_FRAMES } from "./videos/Hype.tsx";
import { OPEN_IT_FRAMES, OpenIt } from "./videos/OpenIt.tsx";
import { Sting, STING_FRAMES } from "./videos/Sting.tsx";
import { Story, STORY_FRAMES } from "./videos/Story.tsx";
import { Tour, TOUR_FRAMES } from "./videos/Tour.tsx";

const SHAPES = {
	wide: { width: 1920, height: 1080 },
	square: { width: 1080, height: 1080 },
	tall: { width: 1080, height: 1920 },
} as const;

export function Root() {
	return (
		<>
			<Composition
				id="sting-wide"
				component={Sting}
				durationInFrames={STING_FRAMES}
				fps={FPS}
				{...SHAPES.wide}
				defaultProps={{ layout: "horizontal" }}
			/>
			<Composition
				id="sting-square"
				component={Sting}
				durationInFrames={STING_FRAMES}
				fps={FPS}
				{...SHAPES.square}
				defaultProps={{ layout: "stacked" }}
			/>
			<Composition
				id="chest-reel"
				component={ChestReel}
				durationInFrames={CHEST_REEL_FRAMES}
				fps={FPS}
				{...SHAPES.wide}
			/>
			<Composition
				id="fill-it-wide"
				component={FillIt}
				durationInFrames={FILL_IT_FRAMES}
				fps={FPS}
				{...SHAPES.wide}
			/>
			<Composition
				id="open-it-tall"
				component={OpenIt}
				durationInFrames={OPEN_IT_FRAMES}
				fps={FPS}
				{...SHAPES.tall}
			/>
			<Composition
				id="hand-it-out-wide"
				component={HandItOut}
				durationInFrames={HAND_IT_OUT_FRAMES}
				fps={FPS}
				{...SHAPES.wide}
			/>
			<Composition
				id="tour-wide"
				component={Tour}
				durationInFrames={TOUR_FRAMES}
				fps={FPS}
				{...SHAPES.wide}
			/>
			<Composition
				id="story-square"
				component={Story}
				durationInFrames={STORY_FRAMES}
				fps={FPS}
				{...SHAPES.square}
			/>
			<Composition
				id="hype-tall"
				component={Hype}
				durationInFrames={HYPE_FRAMES}
				fps={FPS}
				{...SHAPES.tall}
			/>
			{(["A", "B", "C"] as const).map((id) => {
				const cut = scriptCut(id);

				return (
					<Composition
						key={id}
						id={`creator-${id.toLowerCase()}-${cut.shape}`}
						component={CreatorCut}
						durationInFrames={Math.round(cut.seconds * FPS)}
						fps={FPS}
						{...SHAPES[cut.shape]}
						defaultProps={{ script: id, footage: null, name: "Ifiok Jr." }}
					/>
				);
			})}
			<Still id="x-avatar" component={Avatar} width={800} height={800} />
			<Still id="x-banner" component={Banner} width={1500} height={500} />
			<Still id="share-card" component={ShareCard} width={1200} height={630} />
		</>
	);
}
