/**
 * The site's open flow as a timeline: idle, held until charged, waiting on
 * the chain, the reveal, and the pose the chest keeps. Each phase blends in
 * over 0.2 s, exactly like the site's chest does, so a video shows what the
 * page will.
 */
import {
	chargeFrame,
	type ChestFrame,
	type ChestReaction,
	idleFrame,
	mixFrames,
	restFrame,
	revealFrame,
	revealSeconds,
	waitFrame,
} from "@pina-rs/lootbox-brand";

/** Phase starts, in seconds. */
export type ChestFlow = Readonly<{
	holdAt: number;
	waitAt: number;
	revealAt: number;
	reaction: ChestReaction;
}>;

const BLEND = 0.2;
/** Close enough to a phase start to read the pose just before it. */
const EPSILON = 1 / 120;

function phaseFrame(flow: ChestFlow, t: number): ChestFrame {
	if (t < flow.holdAt) return idleFrame(t);
	if (t < flow.waitAt) {
		return chargeFrame((t - flow.holdAt) / (flow.waitAt - flow.holdAt), t);
	}
	if (t < flow.revealAt) return waitFrame(t - flow.waitAt);

	const into = t - flow.revealAt;
	const played = revealSeconds(flow.reaction);

	return into < played
		? revealFrame(flow.reaction, into)
		: restFrame(flow.reaction, into - played);
}

export function chestFlowFrame(flow: ChestFlow, t: number): ChestFrame {
	for (const start of [flow.holdAt, flow.waitAt, flow.revealAt]) {
		if (t >= start && t < start + BLEND) {
			return mixFrames(
				phaseFrame(flow, start - EPSILON),
				phaseFrame(flow, t),
				(t - start) / BLEND,
			);
		}
	}

	return phaseFrame(flow, t);
}
