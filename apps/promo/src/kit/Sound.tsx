/**
 * Music beds and sound effects. All audio is original and synthesised by
 * `audio/render.ts`, so the videos are safe to post anywhere.
 */
import { Audio, interpolate, Sequence, staticFile } from "remotion";

export type Track =
	| "treasure-hop"
	| "treasure-hop-30"
	| "treasure-hop-15"
	| "vault-lofi"
	| "big-reveal"
	| "logo-sting";

export type Effect =
	| "ui-click"
	| "ui-pop"
	| "blip-up"
	| "blip-down"
	| "type-tick"
	| "whoosh"
	| "whoosh-reverse"
	| "coin-clink"
	| "coins-cascade"
	| "sparkle"
	| "chest-creak"
	| "chest-thud"
	| "lock-click"
	| "drumroll"
	| "fanfare-short"
	| "aww"
	| "cash-register"
	| "notification";

/**
 * A music bed with a gentle fade in and out. `trimBefore` starts partway
 * into the track; `fadeOut` ends it early without a hard cut.
 */
export function Music(
	{
		track,
		volume = 0.8,
		from = 0,
		durationInFrames,
		fadeOut = 20,
		trimBefore = 0,
	}: Readonly<{
		track: Track;
		volume?: number;
		from?: number;
		durationInFrames: number;
		fadeOut?: number;
		trimBefore?: number;
	}>,
) {
	return (
		<Sequence from={from} durationInFrames={durationInFrames} layout="none">
			<Audio
				src={staticFile(`audio/music/${track}.m4a`)}
				trimBefore={trimBefore}
				volume={(frame) =>
					volume *
					interpolate(
						frame,
						[0, 6, durationInFrames - fadeOut, durationInFrames],
						[0, 1, 1, 0],
						{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
					)}
			/>
		</Sequence>
	);
}

/** One sound effect starting at `at`. */
export function Sfx(
	{ name, at, volume = 0.7 }: Readonly<
		{ name: Effect; at: number; volume?: number }
	>,
) {
	return (
		<Sequence from={Math.round(at)} layout="none">
			<Audio src={staticFile(`audio/sfx/${name}.m4a`)} volume={volume} />
		</Sequence>
	);
}
