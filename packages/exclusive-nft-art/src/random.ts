/**
 * Seeded pseudo-randomness for decorative scatter (stars, sparkles).
 *
 * Art must be a pure function of its traits, so nothing here touches
 * `Math.random`. FNV-1a turns a label into a 32-bit seed and mulberry32 turns
 * the seed into a stream. Neither is cryptographic; they only place sparkles.
 */
export type Random = () => number;

/** FNV-1a over the UTF-16 code units of `label`. */
export function seedFrom(label: string): number {
	let hash = 0x811c9dc5;

	for (let index = 0; index < label.length; index++) {
		hash ^= label.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}

	return hash;
}

/** A mulberry32 stream in [0, 1). */
export function randomFrom(seed: number): Random {
	let state = seed >>> 0;

	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A value in [min, max). */
export function between(random: Random, min: number, max: number): number {
	return min + random() * (max - min);
}
